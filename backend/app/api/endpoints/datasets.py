import os
import uuid
import json
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
import pandas as pd
import numpy as np

from app.core.config import settings

router = APIRouter()

def get_column_type(dtype, series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(dtype):
        return "Numeric"
    elif pd.api.types.is_datetime64_any_dtype(dtype):
        return "Datetime"
    else:
        # Check if text column can be parsed as Datetime
        try:
            # Check a sample of non-null values (up to 10)
            sample = series.dropna().head(10)
            if not sample.empty:
                # If it's mostly numeric strings, don't parse as date
                if sample.astype(str).str.isnumeric().all():
                    return "Text"
                pd.to_datetime(sample, errors='raise')
                return "Datetime"
        except (ValueError, TypeError, AttributeError):
            pass
        return "Text"

def format_memory_usage(bytes_size: int) -> str:
    if bytes_size < 1024:
        return f"{bytes_size} B"
    elif bytes_size < 1024 * 1024:
        return f"{bytes_size / 1024:.1f} KB"
    else:
        return f"{bytes_size / (1024 * 1024):.1f} MB"

def to_json_val(val):
    if pd.isna(val):
        return ""
    if isinstance(val, (pd.Timestamp, datetime)):
        return val.isoformat()
    if hasattr(val, "item"):  # converts numpy types to python natives
        return val.item()
    return val

@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    ext = filename.split(".")[-1].lower()
    if ext not in ["csv", "xlsx", "xls"]:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Only CSV, XLS, and XLSX are allowed."
        )
    
    file_id = str(uuid.uuid4())
    save_filename = f"datasets_{file_id}.{ext}"
    save_path = settings.uploads_dir / save_filename
    
    try:
        contents = await file.read()
        with open(save_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    # Parse dataset with Pandas
    try:
        if ext == "csv":
            df = pd.read_csv(save_path)
        else:
            df = pd.read_excel(save_path)
    except Exception as e:
        # Cleanup file if parsing fails
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(status_code=400, detail=f"Failed to parse spreadsheet: {str(e)}")
        
    try:
        total_rows = len(df)
        total_cols = len(df.columns)
        
        # Missing values
        missing_count = int(df.isna().sum().sum())
        total_cells = total_rows * total_cols
        missing_percent = round((missing_count / total_cells) * 100, 2) if total_cells > 0 else 0.0
        
        # Duplicate rows
        duplicate_count = int(df.duplicated().sum())
        duplicate_percent = round((duplicate_count / total_rows) * 100, 2) if total_rows > 0 else 0.0
        
        # Memory usage
        memory_bytes = int(df.memory_usage(deep=True).sum())
        memory_usage_str = format_memory_usage(memory_bytes)
        
        # Column categorization & profiling
        columns_profile = []
        numeric_count = 0
        date_count = 0
        text_count = 0
        
        for col_name in df.columns:
            series = df[col_name]
            dtype_name = str(series.dtype)
            col_type = get_column_type(series.dtype, series)
            
            if col_type == "Numeric":
                numeric_count += 1
            elif col_type == "Datetime":
                date_count += 1
            else:
                text_count += 1
                
            col_missing = int(series.isna().sum())
            col_missing_pct = round((col_missing / total_rows) * 100, 2) if total_rows > 0 else 0.0
            unique_count = int(series.nunique())
            
            columns_profile.append({
                "name": col_name,
                "type": col_type,
                "raw_type": dtype_name,
                "missing_count": col_missing,
                "missing_percent": col_missing_pct,
                "unique_count": unique_count
            })
            
        # Get head for preview (up to 10 rows)
        preview_headers = list(df.columns)
        preview_rows = []
        
        for _, row in df.head(10).iterrows():
            preview_rows.append([to_json_val(val) for val in row.values])
            
        metadata = {
            "file_id": file_id,
            "filename": filename,
            "file_size": len(contents),
            "total_rows": total_rows,
            "total_columns": total_cols,
            "missing_count": missing_count,
            "missing_percent": missing_percent,
            "duplicate_count": duplicate_count,
            "duplicate_percent": duplicate_percent,
            "memory_bytes": memory_bytes,
            "memory_usage": memory_usage_str,
            "numeric_columns_count": numeric_count,
            "date_columns_count": date_count,
            "text_columns_count": text_count,
            "columns": columns_profile,
            "preview_headers": preview_headers,
            "preview_rows": preview_rows
        }
        
        # Save metadata JSON file
        meta_path = settings.uploads_dir / f"datasets_{file_id}_meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
            
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate dataset profile: {str(e)}")

@router.get("/{file_id}")
async def get_dataset_metadata(file_id: str):
    meta_path = settings.uploads_dir / f"datasets_{file_id}_meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found or metadata not generated yet")
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset metadata: {str(e)}")
