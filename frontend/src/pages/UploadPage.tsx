import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

type FilePreviewRow = string[]

const acceptedExtensions = ['csv', 'xls', 'xlsx']

const uploadHighlights = [
  'Excel and CSV support',
  'Dataset preview',
  'Validation ready',
  'Upload progress state',
]

function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function parseCsvPreview(text: string) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 6)

  return rows.map((row) => row.split(',').map((cell) => cell.trim()))
}

export function UploadPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [previewRows, setPreviewRows] = useState<FilePreviewRow[]>([])

  const fileSummary = useMemo(() => {
    if (!selectedFile) {
      return [
        { label: 'File status', value: 'Waiting for upload' },
        { label: 'Format', value: '.csv / .xls / .xlsx' },
        { label: 'Upload mode', value: 'Local browser preview' },
      ]
    }

    return [
      { label: 'File name', value: selectedFile.name },
      { label: 'File size', value: formatFileSize(selectedFile.size) },
      { label: 'File type', value: selectedFile.type || getExtension(selectedFile.name).toUpperCase() },
    ]
  }, [selectedFile])

  function resetSelection() {
    setSelectedFile(null)
    setErrorMessage('')
    setUploadProgress(0)
    setIsUploading(false)
    setPreviewRows([])

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) {
      return
    }

    const extension = getExtension(file.name)

    if (!acceptedExtensions.includes(extension)) {
      setErrorMessage('Only CSV, XLS, and XLSX files are supported.')
      return
    }

    setErrorMessage('')
    setSelectedFile(file)
    setUploadProgress(0)
    setIsUploading(false)

    if (extension === 'csv') {
      const text = await file.text()
      setPreviewRows(parseCsvPreview(text))
    } else {
      setPreviewRows([
        ['Workbook preview'],
        ['Excel files are ready for backend parsing in the next step.'],
      ])
    }
  }

  async function startUpload() {
    if (!selectedFile) {
      setErrorMessage('Choose a file before starting the upload.')
      return
    }

    setErrorMessage('')
    setUploadProgress(0)
    setIsUploading(true)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await axios.post('http://localhost:8000/api/v1/datasets/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 50
          setUploadProgress(percentCompleted)
        },
      })

      // Show completion briefly
      setUploadProgress(100)
      setTimeout(() => {
        setIsUploading(false)
        navigate(`/overview?fileId=${response.data.file_id}`)
      }, 500)
    } catch (error: any) {
      setIsUploading(false)
      setUploadProgress(0)
      const errorMsg =
        error.response?.data?.detail || error.message || 'An error occurred during upload.'
      setErrorMessage(errorMsg)
    }
  }


  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFile(event.target.files?.[0])
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    void handleFile(event.dataTransfer.files?.[0])
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
      <motion.article
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-8"
      >
        <div className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200">
          Upload workspace
        </div>

        <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Upload your spreadsheet and turn it into a business intelligence dashboard.
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
          Start with Excel or CSV files, then automatically profile the dataset, prepare it for
          cleaning, and route it into dashboards, insights, and forecasting.
        </p>

        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          onDragEnter={() => setIsDragging(true)}
          onDragOver={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={[
            'mt-8 rounded-[1.75rem] border border-dashed bg-slate-950/50 p-8 text-center shadow-inner shadow-sky-500/5 transition-all',
            isDragging ? 'border-emerald-400/70 bg-emerald-400/10' : 'border-sky-400/40',
          ].join(' ')}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-400/15 text-2xl text-sky-300">
            ⤴
          </div>
          <h2 className="mt-5 text-xl font-semibold text-white">Drag and drop your file</h2>
          <p className="mt-2 text-sm text-slate-400">or choose a local file to begin analysis</p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
            >
              Browse file
            </button>
            <button
              type="button"
              onClick={resetSelection}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={startUpload}
              className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
            >
              Start upload
            </button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {errorMessage ? (
            <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </p>
          ) : null}

          {selectedFile ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Selected file</p>
                  <p className="mt-1 text-lg font-semibold text-white">{selectedFile.name}</p>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">
                  {isUploading ? 'Uploading' : uploadProgress === 100 ? 'Complete' : 'Ready'}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {fileSummary.map((summary) => (
                  <div
                    key={summary.label}
                    className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
                  >
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{summary.label}</p>
                    <p className="mt-2 break-words text-sm text-slate-100">{summary.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400"
                initial={{ width: '0%' }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-slate-500">
              <span>Upload progress</span>
              <span>{uploadProgress}%</span>
            </div>
          </div>

          {previewRows.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
              <div className="border-b border-white/10 px-4 py-3 text-left text-sm font-medium text-slate-200">
                File preview
              </div>
              <div className="max-h-56 overflow-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr
                        key={`${row.join('-')}-${rowIndex}`}
                        className="border-b border-white/5 last:border-b-0"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${cell}-${cellIndex}`}
                            className="border-r border-white/5 px-4 py-2 text-slate-300 last:border-r-0"
                          >
                            {cell || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.article>

      <div className="grid gap-6">
        <motion.article
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
          className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl"
        >
          <p className="text-sm font-medium text-sky-300">What happens next</p>
          <div className="mt-5 space-y-4">
            {uploadHighlights.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                  ✓
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl"
        >
          <p className="text-sm font-medium text-slate-200">Supported formats</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">.xlsx</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">.xls</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">.csv</div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">Local</div>
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.15 }}
          className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl"
        >
          <p className="text-sm font-medium text-sky-300">Validation rules</p>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>• Only CSV, XLS, and XLSX files are accepted.</li>
            <li>• File metadata is shown immediately after selection.</li>
            <li>• CSV files render a lightweight preview in the browser.</li>
            <li>• Upload progress is simulated to match the future API flow.</li>
          </ul>
        </motion.article>
      </div>
    </section>
  )
}