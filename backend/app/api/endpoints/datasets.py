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


@router.get("/{file_id}/profiling")
async def get_dataset_profiling(file_id: str):
    # Check cache first
    profiling_path = settings.uploads_dir / f"datasets_{file_id}_profiling.json"
    if profiling_path.exists():
        try:
            with open(profiling_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Find the dataset spreadsheet file
    file_path = None
    original_filename = "dataset"
    for ext in ["csv", "xlsx", "xls"]:
        p = settings.uploads_dir / f"datasets_{file_id}.{ext}"
        if p.exists():
            file_path = p
            break

    if not file_path:
        # Fallback: check if we can read the original filename from metadata
        meta_path = settings.uploads_dir / f"datasets_{file_id}_meta.json"
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    original_filename = meta.get("filename", "dataset")
            except Exception:
                pass
        raise HTTPException(status_code=404, detail="Dataset file not found")

    ext = file_path.suffix.lower()
    try:
        if ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset file: {str(e)}")

    try:
        total_rows = len(df)
        total_cols = len(df.columns)

        # Calculate correlation matrix for numeric columns
        numeric_df = df.select_dtypes(include=[np.number])
        correlation = {}
        if len(numeric_df.columns) > 1:
            corr_df = numeric_df.corr().fillna(0)
            correlation = {
                "columns": list(corr_df.columns),
                "values": [[to_json_val(val) for val in row] for row in corr_df.values.tolist()]
            }

        columns_profiling = {}
        warnings = []

        for col_name in df.columns:
            series = df[col_name]
            dtype = series.dtype
            col_type = get_column_type(dtype, series)

            n_missing = int(series.isna().sum())
            pct_missing = round((n_missing / total_rows) * 100, 2) if total_rows > 0 else 0.0
            n_unique = int(series.nunique())

            col_data = {
                "name": col_name,
                "type": col_type,
                "missing_count": n_missing,
                "missing_percent": pct_missing,
                "unique_count": n_unique,
            }

            # Data Quality warnings
            if pct_missing > 50:
                warnings.append({
                    "column": col_name,
                    "type": "High Missing Values",
                    "severity": "High",
                    "message": f"Column '{col_name}' has {pct_missing:.1f}% missing values."
                })
            elif pct_missing > 10:
                warnings.append({
                    "column": col_name,
                    "type": "Missing Values Warning",
                    "severity": "Medium",
                    "message": f"Column '{col_name}' has {pct_missing:.1f}% missing values."
                })

            if n_unique == 1:
                warnings.append({
                    "column": col_name,
                    "type": "Constant Column",
                    "severity": "Medium",
                    "message": f"Column '{col_name}' contains only a single unique value."
                })
            elif n_unique > 0 and col_type == "Text" and (n_unique / total_rows) > 0.95 and total_rows > 10:
                warnings.append({
                    "column": col_name,
                    "type": "High Cardinality Text",
                    "severity": "Low",
                    "message": f"Column '{col_name}' has very high cardinality ({n_unique} unique values). It might be an ID or key column."
                })

            # Column specific profiling
            if col_type == "Numeric":
                non_null_series = series.dropna()
                mean_val = float(non_null_series.mean()) if not non_null_series.empty else 0.0
                std_val = float(non_null_series.std()) if len(non_null_series) > 1 else 0.0
                min_val = float(non_null_series.min()) if not non_null_series.empty else 0.0
                max_val = float(non_null_series.max()) if not non_null_series.empty else 0.0
                median_val = float(non_null_series.median()) if not non_null_series.empty else 0.0
                q25 = float(non_null_series.quantile(0.25)) if not non_null_series.empty else 0.0
                q75 = float(non_null_series.quantile(0.75)) if not non_null_series.empty else 0.0
                skew = float(non_null_series.skew()) if len(non_null_series) > 2 else 0.0
                kurtosis = float(non_null_series.kurtosis()) if len(non_null_series) > 3 else 0.0

                if abs(skew) > 1.5:
                    warnings.append({
                        "column": col_name,
                        "type": "High Skewness",
                        "severity": "Low",
                        "message": f"Column '{col_name}' has high skewness ({skew:.2f})."
                    })

                distribution = []
                if not non_null_series.empty:
                    counts, bin_edges = np.histogram(non_null_series, bins=10)
                    for i in range(len(counts)):
                        distribution.append({
                            "range": f"{bin_edges[i]:.2f} - {bin_edges[i+1]:.2f}",
                            "count": int(counts[i])
                        })

                col_data["stats"] = {
                    "mean": to_json_val(mean_val),
                    "std": to_json_val(std_val),
                    "min": to_json_val(min_val),
                    "max": to_json_val(max_val),
                    "median": to_json_val(median_val),
                    "q25": to_json_val(q25),
                    "q75": to_json_val(q75),
                    "skew": to_json_val(skew),
                    "kurtosis": to_json_val(kurtosis)
                }
                col_data["distribution"] = distribution
            else:
                # Text or Datetime: Top categories distribution
                vc = series.value_counts(dropna=True).head(15)
                distribution = [{"range": str(k), "count": int(v)} for k, v in vc.items()]
                col_data["distribution"] = distribution

            columns_profiling[col_name] = col_data

        # Get original filename from meta if possible
        meta_path = settings.uploads_dir / f"datasets_{file_id}_meta.json"
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    original_filename = meta.get("filename", file_path.name)
            except Exception:
                pass

        profile_data = {
            "file_id": file_id,
            "filename": original_filename,
            "total_rows": total_rows,
            "total_columns": total_cols,
            "correlation": correlation,
            "columns": columns_profiling,
            "warnings": warnings
        }

        # Cache the result
        with open(profiling_path, "w", encoding="utf-8") as f:
            json.dump(profile_data, f, indent=2)

        return profile_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate dataset profiling: {str(e)}")

