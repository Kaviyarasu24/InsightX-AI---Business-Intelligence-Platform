import os
import uuid
import json
import urllib.request
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel
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


def generate_fallback_schema(df: pd.DataFrame, error_msg: str) -> dict:
    numeric_cols = []
    text_cols = []
    date_cols = []

    for col in df.columns:
        dtype = df[col].dtype
        if pd.api.types.is_numeric_dtype(dtype):
            numeric_cols.append(col)
        elif pd.api.types.is_datetime64_any_dtype(dtype) or "date" in col.lower() or "time" in col.lower():
            date_cols.append(col)
        else:
            text_cols.append(col)

    # Pick primary/secondary metrics
    primary_metric = None
    primary_candidates = ["sales", "revenue", "amount", "price", "total", "income", "turnover", "value"]
    for cand in primary_candidates:
        for col in numeric_cols:
            if cand in col.lower():
                primary_metric = col
                break
        if primary_metric:
            break

    if not primary_metric and numeric_cols:
        primary_metric = numeric_cols[0]

    is_dummy_metric = False
    if not primary_metric:
        df["_DummyMetric"] = 1
        primary_metric = "_DummyMetric"
        is_dummy_metric = True

    secondary_metric = None
    secondary_candidates = ["profit", "margin", "cost", "quantity", "qty", "count", "discount"]
    for cand in secondary_candidates:
        for col in numeric_cols:
            if cand in col.lower() and col != primary_metric:
                secondary_metric = col
                break
        if secondary_metric:
            break

    if not secondary_metric and len(numeric_cols) > 1:
        for col in numeric_cols:
            if col != primary_metric:
                secondary_metric = col
                break

    # Categorical columns
    breakdown_cols = []
    for col in text_cols:
        if col != primary_metric and col != secondary_metric:
            u_count = df[col].nunique()
            if 1 < u_count <= 35:
                breakdown_cols.append(col)

    cat_col = breakdown_cols[0] if breakdown_cols else (text_cols[0] if text_cols else df.columns[0])
    cat_col2 = breakdown_cols[1] if len(breakdown_cols) > 1 else cat_col

    # Helper to check if a column represents currency
    def is_currency_col(col_name: str) -> bool:
        currency_keywords = ["sales", "revenue", "price", "profit", "cost", "amount", "income", 
                             "fee", "budget", "spend", "commission", "rate", "salary", "wage", 
                             "payment", "expenses"]
        return any(k in col_name.lower() for k in currency_keywords)

    is_primary_currency = is_currency_col(primary_metric) and not is_dummy_metric
    is_secondary_currency = is_currency_col(secondary_metric) if secondary_metric else is_primary_currency

    # Simple 6 KPIs list
    kpis = [
        {
            "label": "Total " + primary_metric if not is_dummy_metric else "Total Records",
            "column": primary_metric,
            "agg": "sum" if not is_dummy_metric else "count",
            "is_currency": is_primary_currency
        },
        {
            "label": "Total " + secondary_metric if secondary_metric else "Estimated Profit",
            "column": secondary_metric or primary_metric,
            "agg": "sum" if secondary_metric else "sum",
            "is_currency": is_secondary_currency
        },
        {
            "label": "Total Records",
            "column": primary_metric,
            "agg": "count",
            "is_currency": False
        },
        {
            "label": "Average " + primary_metric if not is_dummy_metric else "Avg Value",
            "column": primary_metric,
            "agg": "mean",
            "is_currency": is_primary_currency
        },
        {
            "label": "Max " + primary_metric,
            "column": primary_metric,
            "agg": "max",
            "is_currency": is_primary_currency
        },
        {
            "label": "Unique " + (text_cols[0] if text_cols else df.columns[0]),
            "column": text_cols[0] if text_cols else df.columns[0],
            "agg": "nunique",
            "is_currency": False
        }
    ]

    return {
        "primary_metric": primary_metric,
        "secondary_metric": secondary_metric or None,
        "primary_label": "Total " + primary_metric if not is_dummy_metric else "Total Records",
        "secondary_label": "Total " + secondary_metric if secondary_metric else None,
        "orders_label": "Total Records",
        "is_primary_currency": is_primary_currency,
        "is_secondary_currency": is_secondary_currency,
        "kpis": kpis,
        "is_fallback": True,
        "error_message": error_msg,
        "charts": {
            "line": {
                "x_column": date_cols[0] if date_cols else df.columns[0],
                "y_column": primary_metric
            },
            "bar": {
                "x_column": cat_col,
                "y_column": primary_metric
            },
            "pie": {
                "x_column": cat_col2,
                "y_column": primary_metric
            },
            "scatter": {
                "x_column": primary_metric,
                "y_column": secondary_metric or primary_metric
            },
            "treemap": {
                "parent_column": cat_col,
                "child_column": cat_col2,
                "value_column": primary_metric
            },
            "heatmap": {
                "x_column": cat_col,
                "y_column": cat_col2,
                "value_column": primary_metric
            }
        }
    }


def analyze_schema_via_llm(file_id: str, df: pd.DataFrame) -> dict:
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API Key is not configured. Please set OPENROUTER_API_KEY in your .env file."
        )

    # 1. Compile columns, data types, and a small row sample
    columns_info = []
    for col in df.columns:
        columns_info.append({
            "name": col,
            "pandas_type": str(df[col].dtype)
        })

    # Get first 3 rows as list of dicts, serializing values safely
    sample_rows = []
    for _, row in df.head(3).iterrows():
        sample_rows.append({col: to_json_val(row[col]) for col in df.columns})

    # 2. Design LLM Prompt and Payload
    prompt = f"""
    You are an expert Data Scientist and BI Architect.
    Analyze the following dataset columns and sample data:

    Columns metadata:
    {json.dumps(columns_info, indent=2)}

    Sample data (first 3 rows):
    {json.dumps(sample_rows, indent=2)}

    Determine the optimal BI dashboard configuration for this dataset. Output a single JSON object (with NO markdown formatting, NO ```json wrapping, just raw JSON) following this strict schema:
    {{
      "primary_metric": "name of the primary numeric column for aggregations (e.g. Sales, Maths, Temp, Score)",
      "secondary_metric": "name of the secondary numeric column (e.g. Profit, Science, Humidity, Age) or null",
      "primary_label": "Human-friendly label for primary sum metric (e.g. Total Revenue, Total Marks, Sum of Temp)",
      "secondary_label": "Human-friendly label for secondary sum metric (e.g. Total Profit, Total Science) or null",
      "orders_label": "Human-friendly count label based on records (e.g. Total Orders, Total Students, Total Logs)",
      "is_primary_currency": true/false (set to true only if primary_metric represents currency/money),
      "is_secondary_currency": true/false (set to true only if secondary_metric represents currency/money),
      "kpis": [
        {{
          "label": "Card Label (e.g. Average Score, Total Revenue, Unique Cities)",
          "column": "column_name",
          "agg": "sum" | "mean" | "count" | "nunique" | "max" | "min",
          "is_currency": true/false
        }}
      ],
      "charts": {{
        "line": {{
          "x_column": "datetime or date column (if available) or the first column",
          "y_column": "numeric column to plot (primary_metric)"
        }},
        "bar": {{
          "x_column": "categorical column with 2-35 unique values (e.g. Class, Category, Region)",
          "y_column": "numeric column (primary_metric)"
        }},
        "pie": {{
          "x_column": "another categorical column (or same if only one exists)",
          "y_column": "numeric column (primary_metric)"
        }},
        "scatter": {{
          "x_column": "primary_metric",
          "y_column": "secondary_metric or another numeric column"
        }},
        "treemap": {{
          "parent_column": "categorical column (e.g. Category)",
          "child_column": "another categorical column (e.g. Sub-Category) or null",
          "value_column": "numeric column (primary_metric)"
        }},
        "heatmap": {{
          "x_column": "categorical column (e.g. Region)",
          "y_column": "another categorical column (e.g. Category)",
          "value_column": "numeric column (primary_metric)"
        }}
      }}
    }}

    Important rules:
    - Choose exactly 6 KPIs in the "kpis" array.
    - All column fields MUST exist in the dataset columns.
    - Do not wrap the JSON output in markdown ticks. Output the clean JSON string directly.
    """

    payload = {
        "model": "google/gemini-2.5-flash",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }

    try:
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://insightx.ai",
                "X-Title": "InsightX AI"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=20) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            content = res_body["choices"][0]["message"]["content"].strip()

            if content.startswith("```"):
                content = content.split("```", 2)[1]
                if content.startswith("json"):
                    content = content[4:].strip()

            schema = json.loads(content)

            schema_path = settings.uploads_dir / f"datasets_{file_id}_dashboard_schema.json"
            with open(schema_path, "w", encoding="utf-8") as f:
                json.dump(schema, f, indent=2)

            return schema
    except Exception as e:
        error_msg = str(e)
        if "402" in error_msg or "Payment Required" in error_msg:
            error_msg = "HTTP Error 402: Payment Required (Please check your OpenRouter API Key balance/credits)."
        elif "401" in error_msg or "Unauthorized" in error_msg:
            error_msg = "HTTP Error 401: Unauthorized (Invalid OpenRouter API Key)."
        
        # Save fallback schema
        schema = generate_fallback_schema(df, error_msg)
        schema_path = settings.uploads_dir / f"datasets_{file_id}_dashboard_schema.json"
        with open(schema_path, "w", encoding="utf-8") as f:
            json.dump(schema, f, indent=2)
        return schema


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

        # Exclusive OpenRouter check and run
        if not settings.openrouter_api_key:
            raise HTTPException(
                status_code=400,
                detail="OpenRouter API Key is not configured. Please configure OPENROUTER_API_KEY in your backend .env file."
            )
        
        analyze_schema_via_llm(file_id, df)
            
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


@router.get("/{file_id}/data")
async def get_dataset_data(
    file_id: str,
    page: int = 1,
    limit: int = 50,
    sort_by: str = None,
    sort_order: str = "asc",
    search: str = None,
    filters: str = None
):
    # Find dataset file
    file_path = None
    for ext in ["csv", "xlsx", "xls"]:
        p = settings.uploads_dir / f"datasets_{file_id}.{ext}"
        if p.exists():
            file_path = p
            break

    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    # Load dataset
    ext = file_path.suffix.lower()
    try:
        if ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset file: {str(e)}")

    total_rows = len(df)

    # 1. Global search
    if search:
        search_str = str(search).strip()
        if search_str:
            masks = []
            for col in df.columns:
                col_mask = df[col].astype(str).str.contains(search_str, case=False, na=False)
                masks.append(col_mask)
            if masks:
                global_mask = pd.concat(masks, axis=1).any(axis=1)
                df = df[global_mask]

    # 2. Column-specific filters
    if filters:
        try:
            filter_dict = json.loads(filters)
            for col, val in filter_dict.items():
                if col in df.columns:
                    if isinstance(val, dict):
                        # Numeric range filter: min and/or max
                        if "min" in val and val["min"] is not None and val["min"] != "":
                            df = df[pd.to_numeric(df[col], errors='coerce') >= float(val["min"])]
                        if "max" in val and val["max"] is not None and val["max"] != "":
                            df = df[pd.to_numeric(df[col], errors='coerce') <= float(val["max"])]
                    elif isinstance(val, list):
                        # Categorical multi-select filter
                        if len(val) > 0:
                            df = df[df[col].astype(str).isin([str(v) for v in val])]
                    else:
                        # Substring search filter
                        if val is not None and val != "":
                            df = df[df[col].astype(str).str.contains(str(val), case=False, na=False)]
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format for filters")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Filtering error: {str(e)}")

    # 3. Sorting
    if sort_by and sort_by in df.columns:
        ascending = sort_order.lower() == "asc"
        df = df.sort_values(by=sort_by, ascending=ascending, na_position="last")

    total_filtered = len(df)

    # Normalize pagination
    page = max(1, page)
    limit = max(1, min(100, limit))
    start_idx = (page - 1) * limit
    end_idx = page * limit

    # Paginate slice
    df_page = df.iloc[start_idx:end_idx]

    # Get column definitions from metadata if available
    columns_info = []
    meta_path = settings.uploads_dir / f"datasets_{file_id}_meta.json"
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                columns_info = meta.get("columns", [])
        except Exception:
            pass

    # Fallback to df columns list if metadata was empty
    if not columns_info:
        for col_name in df.columns:
            columns_info.append({
                "name": col_name,
                "type": "Text",  # Default fallback
                "unique_count": int(df[col_name].nunique())
            })

    # Prepare JSON serializable rows
    headers = list(df.columns)
    rows = []
    for _, row in df_page.iterrows():
        rows.append([to_json_val(val) for val in row.values])

    return {
        "headers": headers,
        "rows": rows,
        "columns": columns_info,
        "page": page,
        "limit": limit,
        "total_rows": total_rows,
        "total_filtered": total_filtered
    }


@router.get("/{file_id}/dashboard")
async def get_dataset_dashboard(file_id: str, filters: str = None):
    # Find dataset file
    file_path = None
    for ext in ["csv", "xlsx", "xls"]:
        p = settings.uploads_dir / f"datasets_{file_id}.{ext}"
        if p.exists():
            file_path = p
            break

    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    # Load dataset
    ext = file_path.suffix.lower()
    try:
        if ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset file: {str(e)}")

    # 1. Apply active dashboard filters
    if filters:
        try:
            filter_dict = json.loads(filters)
            for col, val in filter_dict.items():
                if col in df.columns:
                    if isinstance(val, list) and len(val) > 0:
                        df = df[df[col].astype(str).isin([str(v) for v in val])]
                    elif isinstance(val, dict):
                        if "min" in val and val["min"] is not None and val["min"] != "":
                            df = df[pd.to_numeric(df[col], errors='coerce') >= float(val["min"])]
                        if "max" in val and val["max"] is not None and val["max"] != "":
                            df = df[pd.to_numeric(df[col], errors='coerce') <= float(val["max"])]
                    else:
                        if val is not None and val != "":
                            df = df[df[col].astype(str) == str(val)]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Filtering error: {str(e)}")

    # 2. Get LLM-generated dashboard schema configuration
    schema_path = settings.uploads_dir / f"datasets_{file_id}_dashboard_schema.json"
    if not schema_path.exists():
        # Generate on-the-fly via OpenRouter if missing
        if not settings.openrouter_api_key:
            raise HTTPException(
                status_code=400,
                detail="OpenRouter API Key is not configured. Please configure OPENROUTER_API_KEY in your backend .env file."
            )
        try:
            if ext == ".csv":
                orig_df = pd.read_csv(file_path)
            else:
                orig_df = pd.read_excel(file_path)
            schema = analyze_schema_via_llm(file_id, orig_df)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate dynamic dashboard schema layout: {str(e)}"
            )
    else:
        with open(schema_path, "r", encoding="utf-8") as f:
            schema = json.load(f)

    # 3. Retrieve configuration fields
    primary_metric = schema.get("primary_metric")
    secondary_metric = schema.get("secondary_metric")
    
    # Fallback safety if column names are not found in dataset
    if primary_metric not in df.columns:
        numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
        primary_metric = numeric_cols[0] if numeric_cols else df.columns[0]
        
    if secondary_metric and secondary_metric not in df.columns:
        secondary_metric = None

    is_primary_currency = bool(schema.get("is_primary_currency", False))
    is_secondary_currency = bool(schema.get("is_secondary_currency", False))

    # Helper function for serializing numbers safely
    def clean_val(v):
        if pd.isna(v) or np.isinf(v):
            return 0.0
        return float(v)

    def format_metric_value(val, is_currency: bool) -> str:
        if pd.isna(val) or np.isinf(val):
            return "0"
        if is_currency:
            return f"${float(val):,.2f}"
        if float(val).is_integer():
            return f"{int(val):,}"
        return f"{float(val):,.2f}"

    # Handle empty dataset after filter
    if df.empty:
        empty_kpis = []
        for kpi_def in schema.get("kpis", [])[:6]:
            empty_kpis.append({
                "label": kpi_def.get("label", "Metric"),
                "value": "0",
                "change": "0% vs last period",
                "isPositive": True
            })
        while len(empty_kpis) < 6:
            empty_kpis.append({"label": "Records", "value": "0", "change": "0%", "isPositive": True})
            
        return {
            "kpis": empty_kpis,
            "charts": {
                "line": [],
                "bar": [],
                "pie": [],
                "scatter": [],
                "histogram": [],
                "treemap": [],
                "heatmap": {}
            },
            "filter_options": {},
            "primary_metric": primary_metric,
            "secondary_metric": secondary_metric or "",
            "is_primary_currency": is_primary_currency,
            "is_secondary_currency": is_secondary_currency,
            "is_fallback": bool(schema.get("is_fallback", False)),
            "error_message": schema.get("error_message", "")
        }

    # 4. KPI calculations based on schema definitions
    kpis = []
    for kpi_def in schema.get("kpis", [])[:6]:
        label = kpi_def.get("label", "Metric")
        col = kpi_def.get("column")
        agg = kpi_def.get("agg", "sum")
        is_curr = bool(kpi_def.get("is_currency", False))

        # Column safety
        if col not in df.columns:
            col = primary_metric

        val = 0.0
        try:
            if agg == "sum":
                val = clean_val(df[col].sum())
            elif agg == "mean":
                val = clean_val(df[col].mean())
            elif agg == "max":
                val = clean_val(df[col].max())
            elif agg == "min":
                val = clean_val(df[col].min())
            elif agg == "nunique":
                val = float(df[col].nunique())
            elif agg == "count":
                val = float(df[col].count())
            else:
                val = clean_val(df[col].sum())
        except Exception:
            val = 0.0

        if agg in ["count", "nunique"]:
            formatted_val = f"{int(val):,}"
        else:
            formatted_val = format_metric_value(val, is_curr)

        # Growth comparison rate
        growth_rate = 0.0
        has_growth = False

        # Gather any date columns to sort by
        date_cols = list(df.select_dtypes(include=[np.datetime64]).columns)
        line_x = schema.get("charts", {}).get("line", {}).get("x_column")
        if line_x in df.columns and line_x not in date_cols:
            date_cols.append(line_x)

        if date_cols and len(df) > 4:
            date_col = date_cols[0]
            try:
                df_sorted = df.dropna(subset=[date_col]).copy()
                df_sorted[date_col] = pd.to_datetime(df_sorted[date_col], errors="coerce")
                df_sorted = df_sorted.dropna(subset=[date_col]).sort_values(by=date_col)

                if not df_sorted.empty:
                    mid = len(df_sorted) // 2
                    if agg == "nunique":
                        sum1 = float(df_sorted.iloc[:mid][col].nunique())
                        sum2 = float(df_sorted.iloc[mid:][col].nunique())
                    elif agg == "count":
                        sum1 = float(df_sorted.iloc[:mid][col].count())
                        sum2 = float(df_sorted.iloc[mid:][col].count())
                    else:
                        sum1 = clean_val(df_sorted.iloc[:mid][col].sum())
                        sum2 = clean_val(df_sorted.iloc[mid:][col].sum())

                    if sum1 > 0:
                        growth_rate = ((sum2 - sum1) / sum1) * 100
                        has_growth = True
            except Exception:
                pass
        else:
            mid = len(df) // 2
            if mid > 0:
                if agg == "nunique":
                    sum1 = float(df.iloc[:mid][col].nunique())
                    sum2 = float(df.iloc[mid:][col].nunique())
                elif agg == "count":
                    sum1 = float(df.iloc[:mid][col].count())
                    sum2 = float(df.iloc[mid:][col].count())
                else:
                    sum1 = clean_val(df.iloc[:mid][col].sum())
                    sum2 = clean_val(df.iloc[mid:][col].sum())

                if sum1 > 0:
                    growth_rate = ((sum2 - sum1) / sum1) * 100
                    has_growth = True

        kpis.append({
            "label": label,
            "value": formatted_val,
            "change": f"{growth_rate:+.1f}% vs last period" if has_growth else "Computed from rows",
            "isPositive": growth_rate >= 0
        })

    while len(kpis) < 6:
        kpis.append({
            "label": "Total Records",
            "value": f"{len(df):,}",
            "change": "Record count",
            "isPositive": True
        })

    # 5. Chart Data computations
    charts = {}

    # Line Chart
    line_cfg = schema.get("charts", {}).get("line", {})
    lx = line_cfg.get("x_column")
    ly = line_cfg.get("y_column", primary_metric)
    line_data = []

    if lx in df.columns and ly in df.columns:
        df_line = df.dropna(subset=[lx]).copy()
        try:
            if "date" in lx.lower() or "time" in lx.lower() or pd.api.types.is_datetime64_any_dtype(df_line[lx]):
                df_line[lx] = pd.to_datetime(df_line[lx], errors="coerce")
                df_line = df_line.dropna(subset=[lx])

                min_date = df_line[lx].min()
                max_date = df_line[lx].max()
                delta = max_date - min_date

                if delta.days > 730:
                    period_fmt = "%Y"
                elif delta.days > 60:
                    period_fmt = "%Y-%m"
                else:
                    period_fmt = "%Y-%m-%d"

                df_line["Period"] = df_line[lx].dt.strftime(period_fmt)
                grouped = df_line.groupby("Period")[ly].sum().reset_index()
                grouped = grouped.sort_values(by="Period")
                line_data = [
                    {"name": str(row["Period"]), "value": clean_val(row[ly])}
                    for _, row in grouped.iterrows()
                ]
            else:
                grouped = df_line.groupby(lx)[ly].sum().reset_index().head(30)
                line_data = [
                    {"name": str(row[lx]), "value": clean_val(row[ly])}
                    for _, row in grouped.iterrows()
                ]
        except Exception:
            pass

    if not line_data:
        rolling = df[primary_metric].rolling(window=max(1, len(df)//20)).mean().dropna()
        line_data = [
            {"name": f"Pt {i}", "value": clean_val(val)}
            for i, val in enumerate(rolling.tolist())
        ]
    charts["line"] = line_data

    # Bar Chart
    bar_cfg = schema.get("charts", {}).get("bar", {})
    bx = bar_cfg.get("x_column")
    by = bar_cfg.get("y_column", primary_metric)
    bar_data = []

    if bx in df.columns and by in df.columns:
        try:
            grouped = df.groupby(bx)[by].sum().reset_index()
            grouped = grouped.sort_values(by=by, ascending=False).head(15)
            bar_data = [
                {"name": str(row[bx]), "value": clean_val(row[by])}
                for _, row in grouped.iterrows()
            ]
        except Exception:
            pass
    charts["bar"] = bar_data

    # Pie Chart
    pie_cfg = schema.get("charts", {}).get("pie", {})
    px = pie_cfg.get("x_column")
    py = pie_cfg.get("y_column", primary_metric)
    pie_data = []

    if px in df.columns and py in df.columns:
        try:
            grouped = df.groupby(px)[py].sum().reset_index()
            grouped = grouped.sort_values(by=py, ascending=False).head(10)
            pie_data = [
                {"name": str(row[px]), "value": clean_val(row[py])}
                for _, row in grouped.iterrows()
            ]
        except Exception:
            pass
    charts["pie"] = pie_data

    # Scatter Chart
    scatter_cfg = schema.get("charts", {}).get("scatter", {})
    sx = scatter_cfg.get("x_column", primary_metric)
    sy = scatter_cfg.get("y_column", secondary_metric)
    scatter_data = []

    if sx in df.columns and sy in df.columns:
        try:
            df_sample = df[[sx, sy]].dropna()
            if len(df_sample) > 300:
                df_sample = df_sample.sample(300)
            scatter_data = [
                [clean_val(row[sx]), clean_val(row[sy])]
                for _, row in df_sample.iterrows()
            ]
        except Exception:
            pass
    charts["scatter"] = scatter_data

    # Histogram Chart
    hist_data = []
    try:
        non_null_primary = df[primary_metric].dropna()
        if not non_null_primary.empty:
            counts, bin_edges = np.histogram(non_null_primary, bins=10)
            for i in range(len(counts)):
                hist_data.append({
                    "range": f"{bin_edges[i]:.1f} - {bin_edges[i+1]:.1f}",
                    "count": int(counts[i])
                })
    except Exception:
        pass
    charts["histogram"] = hist_data

    # Treemap Chart
    treemap_cfg = schema.get("charts", {}).get("treemap", {})
    t_parent = treemap_cfg.get("parent_column")
    t_child = treemap_cfg.get("child_column")
    t_val = treemap_cfg.get("value_column", primary_metric)
    treemap_data = []

    if t_parent in df.columns and t_val in df.columns:
        try:
            if t_child in df.columns:
                grouped = df.groupby([t_parent, t_child])[t_val].sum().reset_index()
                hierarchy = {}
                for _, row in grouped.iterrows():
                    p_cat = str(row[t_parent])
                    c_cat = str(row[t_child])
                    val = clean_val(row[t_val])
                    if p_cat not in hierarchy:
                        hierarchy[p_cat] = []
                    hierarchy[p_cat].append({"name": c_cat, "value": val})
                
                treemap_data = [
                    {"name": parent, "children": children}
                    for parent, children in hierarchy.items()
                ]
            else:
                grouped = df.groupby(t_parent)[t_val].sum().reset_index()
                treemap_data = [
                    {"name": str(row[t_parent]), "value": clean_val(row[t_val])}
                    for _, row in grouped.iterrows()
                ]
        except Exception:
            pass
    charts["treemap"] = treemap_data

    # Heatmap Chart
    heatmap_cfg = schema.get("charts", {}).get("heatmap", {})
    hx = heatmap_cfg.get("x_column")
    hy = heatmap_cfg.get("y_column")
    h_val = heatmap_cfg.get("value_column", primary_metric)
    heatmap_data = {}

    if hx in df.columns and hy in df.columns and h_val in df.columns:
        try:
            pivot = df.pivot_table(
                values=h_val,
                index=hy,
                columns=hx,
                aggfunc="mean"
            ).fillna(0)

            pivot = pivot.iloc[:8, :8]

            heatmap_data = {
                "y_axis": list(pivot.index),
                "x_axis": list(pivot.columns),
                "values": [
                    [c_idx, r_idx, clean_val(pivot.iloc[r_idx, c_idx])]
                    for r_idx in range(len(pivot.index))
                    for c_idx in range(len(pivot.columns))
                ]
            }
        except Exception:
            pass
    charts["heatmap"] = heatmap_data

    # 6. Filter Options
    filter_options = {}
    candidate_filter_cols = []
    for c_name, c_cfg in schema.get("charts", {}).items():
        if c_name in ["bar", "pie", "heatmap"]:
            for key in ["x_column", "y_column"]:
                col = c_cfg.get(key)
                if col in df.columns and col not in [primary_metric, secondary_metric] and col not in candidate_filter_cols:
                    if 1 < df[col].nunique() <= 35:
                        candidate_filter_cols.append(col)

    for col in candidate_filter_cols[:4]:
        filter_options[col] = sorted([str(x) for x in df[col].dropna().unique()])

    return {
        "kpis": kpis,
        "charts": charts,
        "filter_options": filter_options,
        "primary_metric": primary_metric,
        "secondary_metric": secondary_metric or "",
        "is_primary_currency": is_primary_currency,
        "is_secondary_currency": is_secondary_currency,
        "is_fallback": bool(schema.get("is_fallback", False)),
        "error_message": schema.get("error_message", "")
    }


@router.get("/{file_id}/insights")
async def get_dataset_insights(file_id: str):
    # Find dataset file
    file_path = None
    original_filename = "dataset"
    for ext in ["csv", "xlsx", "xls"]:
        p = settings.uploads_dir / f"datasets_{file_id}.{ext}"
        if p.exists():
            file_path = p
            break

    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    # Check cached insights first
    insights_path = settings.uploads_dir / f"datasets_{file_id}_insights.json"
    if insights_path.exists():
        try:
            with open(insights_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Read original filename from metadata if possible
    meta_path = settings.uploads_dir / f"datasets_{file_id}_meta.json"
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                original_filename = meta.get("filename", "dataset")
        except Exception:
            pass

    # Verify OpenRouter key configuration
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API Key is not configured. Please configure OPENROUTER_API_KEY in your backend .env file to generate insights."
        )

    # Load dataset
    ext = file_path.suffix.lower()
    try:
        if ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset file: {str(e)}")

    if df.empty:
        return []

    # Get ECharts and KPI aggregates (we run the dashboard endpoint calculation code internally)
    try:
        dashboard_data = await get_dataset_dashboard(file_id, filters=None)
        kpis = dashboard_data.get("kpis", [])
        charts = dashboard_data.get("charts", {})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate dashboard data for AI profiling: {str(e)}")

    # Construct the LLM analytical prompt
    prompt = f"""
    You are an expert Business Intelligence Analyst and Data Scientist.
    Analyze the following calculated BI dashboard statistics and KPIs for the dataset '{original_filename}':

    Overall KPIs:
    {json.dumps(kpis, indent=2)}

    Categorical breakdowns (top categories by volume):
    - Primary breakdown: {json.dumps(charts.get('bar', []), indent=2)}
    - Secondary breakdown: {json.dumps(charts.get('pie', []), indent=2)}

    Treemap breakdown:
    {json.dumps(charts.get('treemap', []), indent=2)[:1500]}

    Provide 4-5 high-impact, professional business insights based on these figures.
    - Each insight must contain specific values (e.g., specific percentages, sums, or segment names) directly from the data. Do not make up numbers.
    - Classify the type of each insight: "Success" (positive trends, highest performers), "Warning" (declining metrics, underperforming segments), or "Info" (neutral structural facts).
    - Classify the impact of each insight: "High", "Medium", or "Low".

    Output a single JSON list (with NO markdown formatting, NO ```json wrapping, just raw JSON) following this strict schema:
    [
      {{
        "title": "Short title of the insight (e.g., Furniture Segments Lead Sales)",
        "text": "Detailed description of the observation, containing specific metrics, percentages, or values.",
        "type": "Success" | "Warning" | "Info",
        "impact": "High" | "Medium" | "Low"
      }}
    ]
    """

    payload = {
        "model": "google/gemini-2.5-flash",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }

    try:
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://insightx.ai",
                "X-Title": "InsightX AI"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            content = res_body["choices"][0]["message"]["content"].strip()

            if content.startswith("```"):
                content = content.split("```", 2)[1]
                if content.startswith("json"):
                    content = content[4:].strip()

            insights = json.loads(content)

            # Save the insights cache
            with open(insights_path, "w", encoding="utf-8") as f:
                json.dump(insights, f, indent=2)

            return insights
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OpenRouter insights generation failed: {str(e)}"
        )


@router.delete("/{file_id}/insights")
async def delete_dataset_insights(file_id: str):
    insights_path = settings.uploads_dir / f"datasets_{file_id}_insights.json"
    if insights_path.exists():
        try:
            insights_path.unlink()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to clear insights cache: {str(e)}")
    return {"status": "success", "message": "Insights cache cleared successfully"}


class QueryRequest(BaseModel):
    query: str
    history: list[dict] = []

@router.post("/{file_id}/query")
async def query_dataset(file_id: str, request: QueryRequest):
    # Find dataset file
    file_path = None
    original_filename = "dataset"
    for ext in ["csv", "xlsx", "xls"]:
        p = settings.uploads_dir / f"datasets_{file_id}.{ext}"
        if p.exists():
            file_path = p
            break

    if not file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    # Read original filename from metadata if possible
    meta_path = settings.uploads_dir / f"datasets_{file_id}_meta.json"
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                original_filename = meta.get("filename", "dataset")
        except Exception:
            pass

    # Verify OpenRouter key configuration
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API Key is not configured. Please configure OPENROUTER_API_KEY in your backend .env file to use AI chat."
        )

    # Load dataset
    ext = file_path.suffix.lower()
    try:
        if ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset file: {str(e)}")

    if df.empty:
        return {
            "explanation": "The dataset is empty.",
            "code": "",
            "data": [],
            "chart_type": None,
            "chart_config": None,
            "error": None
        }

    # Extract dataset details for LLM
    shape = df.shape
    cols_types = {col: str(df[col].dtype) for col in df.columns}
    
    # Sanitize head rows for JSON representation
    try:
        sample_df = df.head(5).copy()
        # Convert timezone-aware datetimes to strings
        for col in sample_df.columns:
            if pd.api.types.is_datetime64_any_dtype(sample_df[col]):
                sample_df[col] = sample_df[col].dt.strftime("%Y-%m-%d %H:%M:%S")
        sample_data = [{k: (to_json_val(v) if not pd.isna(v) else None) for k, v in row.items()} for row in sample_df.to_dict(orient="records")]
    except Exception:
        sample_data = []

    prompt = f"""
    You are an expert BI Analyst and Python Developer. Your goal is to write a short Pandas script to query a dataset to answer the user's question, and explain the result.
    
    The dataset is loaded as a Pandas DataFrame named `df`.
    
    Dataset Details:
    - Shape: {shape[0]} rows, {shape[1]} columns
    - Columns and Data Types:
      {json.dumps(cols_types, indent=2)}
    
    Sample Data (first 5 rows):
    {json.dumps(sample_data, indent=2, default=str)}
    
    User Question: "{request.query}"
    
    Chat History:
    {json.dumps(request.history, indent=2)}
    
    Output Requirements:
    1. Write Python/Pandas code that processes the dataframe `df` to calculate the answer, storing the final resulting DataFrame, Series, or scalar in a variable named `result`.
    2. Your pandas code should be single-line or multi-line. You should ONLY reference the dataframe as `df` and import standard tools like `pandas as pd` or `numpy as np` if necessary. Do NOT try to read any files or modify files.
    3. The code must be valid, bug-free Pandas/Python code.
    4. Provide a clear, professional, and friendly explanation of the results in plain English.
    5. Suggest a visualization if appropriate. Available chart types: "bar", "line", "pie", "scatter". If a chart is recommended, specify the x_column and y_column (which should exist in the query's output `result` variable).
    
    You must return a raw JSON object (with NO markdown formatting, NO ```json wrapping, just raw JSON) following this strict schema:
    {{
      "explanation": "Clear explanation of the findings/results based on the query.",
      "code": "result = df.groupby('Column').sum()...",
      "chart_type": "bar" | "line" | "pie" | "scatter" | null,
      "chart_config": {{
        "x_column": "Name of the X axis column in the result",
        "y_column": "Name of the Y axis column in the result",
        "title": "A title for the chart"
      }} or null
    }}
    """

    payload = {
        "model": "google/gemini-2.5-flash",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1
    }

    try:
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://insightx.ai",
                "X-Title": "InsightX AI"
            },
            method="POST"
        )
        
        explanation = ""
        code_to_exec = ""
        chart_type = None
        chart_config = None
        
        with urllib.request.urlopen(req, timeout=30) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            content = res_body["choices"][0]["message"]["content"].strip()
            
            if content.startswith("```"):
                content = content.split("```", 2)[1]
                if content.startswith("json"):
                    content = content[4:].strip()
            
            res_json = json.loads(content)
            explanation = res_json.get("explanation", "")
            code_to_exec = res_json.get("code", "")
            chart_type = res_json.get("chart_type")
            chart_config = res_json.get("chart_config")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OpenRouter query generation failed: {str(e)}"
        )

    if not code_to_exec:
        return {
            "explanation": explanation,
            "code": "",
            "data": [],
            "chart_type": None,
            "chart_config": None,
            "error": "No code was generated by the model."
        }

    # Execute Pandas code safely
    data_output = []
    exec_error = None
    try:
        # Pre-process the code block
        clean_code = code_to_exec.strip()
        if clean_code.startswith("```python"):
            clean_code = clean_code.split("```python", 1)[1]
            if clean_code.endswith("```"):
                clean_code = clean_code[:-3]
        elif clean_code.startswith("```"):
            clean_code = clean_code.split("```", 1)[1]
            if clean_code.endswith("```"):
                clean_code = clean_code[:-3]
        clean_code = clean_code.strip()

        # Context
        local_vars = {"df": df, "pd": pd, "np": np}
        
        exec(clean_code, {
            "__builtins__": {
                "abs": abs,
                "round": round,
                "sum": sum,
                "min": min,
                "max": max,
                "len": len,
                "list": list,
                "dict": dict,
                "set": set,
                "str": str,
                "int": int,
                "float": float,
                "bool": bool,
                "zip": zip,
                "enumerate": enumerate,
            }
        }, local_vars)
        
        result = local_vars.get("result")
        
        # Serialize the execution result
        if result is not None:
            if isinstance(result, pd.DataFrame):
                sanitized_df = result.copy()
                sanitized_df = sanitized_df.replace({np.nan: None})
                for col in sanitized_df.columns:
                    if pd.api.types.is_datetime64_any_dtype(sanitized_df[col]):
                        sanitized_df[col] = sanitized_df[col].dt.strftime("%Y-%m-%d %H:%M:%S")
                data_output = [{k: (to_json_val(v) if not pd.isna(v) else None) for k, v in row.items()} for row in sanitized_df.to_dict(orient="records")]
            elif isinstance(result, pd.Series):
                series_df = result.reset_index()
                series_df = series_df.replace({np.nan: None})
                for col in series_df.columns:
                    if pd.api.types.is_datetime64_any_dtype(series_df[col]):
                        series_df[col] = series_df[col].dt.strftime("%Y-%m-%d %H:%M:%S")
                data_output = [{k: (to_json_val(v) if not pd.isna(v) else None) for k, v in row.items()} for row in series_df.to_dict(orient="records")]
            elif isinstance(result, (list, tuple, dict)):
                data_output = result
            else:
                data_output = [{"value": to_json_val(result)}]
    except Exception as err:
        exec_error = str(err)

    return {
        "explanation": explanation,
        "code": code_to_exec,
        "data": data_output,
        "chart_type": chart_type,
        "chart_config": chart_config,
        "error": exec_error
    }





