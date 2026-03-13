import React, { useState, useRef, useEffect, useDeferredValue, memo, startTransition } from 'react';
import { 
  Upload, FileText, Trash2, Download, Eye, Code, FilePlus, Settings2, 
  GripVertical, Lock, Unlock, ArrowUpDown, Maximize2, Minimize2,
  Edit3, X, Check, AlertTriangle, Inbox, ArrowDown, ArrowUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MemoizedMarkdown = memo(({ content }: { content: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
));

interface MarkdownFile {
  id: string;
  name: string;
  content: string;
  size: number;
  lastModified: number;
  isLocked: boolean;
  color?: string;
}

type SortType = 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'time-asc' | 'time-desc';

export default function App() {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [keepTitle, setKeepTitle] = useState(true);
  const [titleLevel, setTitleLevel] = useState<1 | 2 | 3>(1);
  const [mergedContent, setMergedContent] = useState('');
  const deferredMergedContent = useDeferredValue(mergedContent);
  const [previewMode, setPreviewMode] = useState<'raw' | 'rendered'>('raw');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  
  // Staging Area & Edit State
  const [stagedFiles, setStagedFiles] = useState<MarkdownFile[]>([]);
  const [showStagedWarning, setShowStagedWarning] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const deferredEditContent = useDeferredValue(editContent);
  
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSource, setDragSource] = useState<'main' | 'staged' | null>(null);
  const [isDraggingToStaged, setIsDraggingToStaged] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{ index: number, position: 'before' | 'after' } | null>(null);
  const [isDraggingOverApp, setIsDraggingOverApp] = useState(false);
  const [showMergeOptionsModal, setShowMergeOptionsModal] = useState(false);
  const dragCounter = useRef(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setFileColor = (id: string, color: string) => {
    setFiles(files.map(f => f.id === id ? { ...f, color } : f));
    setStagedFiles(stagedFiles.map(f => f.id === id ? { ...f, color } : f));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList } }) => {
    if (!e.target.files) return;
    
    const newFiles: MarkdownFile[] = [];
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
        const text = await file.text();
        newFiles.push({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          content: text,
          size: file.size,
          lastModified: file.lastModified,
          isLocked: false,
        });
      }
    }
    
    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const moveToStaged = (index: number) => {
    const file = files[index];
    setFiles(files.filter((_, i) => i !== index));
    setStagedFiles([...stagedFiles, file]);
  };

  const moveToMain = (index: number) => {
    const file = stagedFiles[index];
    setStagedFiles(stagedFiles.filter((_, i) => i !== index));
    setFiles([...files, file]);
  };

  const startEditing = (file: MarkdownFile) => {
    setEditingFileId(file.id);
    setEditContent(file.content);
  };

  const saveEdit = () => {
    if (!editingFileId) return;
    if (files.some(f => f.id === editingFileId)) {
      setFiles(files.map(f => f.id === editingFileId ? { ...f, content: editContent, lastModified: Date.now() } : f));
    } else if (stagedFiles.some(f => f.id === editingFileId)) {
      setStagedFiles(stagedFiles.map(f => f.id === editingFileId ? { ...f, content: editContent, lastModified: Date.now() } : f));
    }
    setEditingFileId(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingFileId(null);
    setEditContent('');
  };

  const toggleLock = (id: string) => {
    setFiles(files.map(f => f.id === id ? { ...f, isLocked: !f.isLocked } : f));
  };

  const allLocked = files.length > 0 && files.every(f => f.isLocked);
  const toggleAllLocks = () => {
    setFiles(files.map(f => ({ ...f, isLocked: !allLocked })));
  };

  const handleSort = (type: SortType) => {
    if (!type) return;
    const lockedIndices = new Set<number>();
    const unlockedFiles: MarkdownFile[] = [];

    files.forEach((file, index) => {
      if (file.isLocked) {
        lockedIndices.add(index);
      } else {
        unlockedFiles.push(file);
      }
    });

    unlockedFiles.sort((a, b) => {
      switch (type) {
        case 'name-asc': return a.name.localeCompare(b.name, 'zh-CN');
        case 'name-desc': return b.name.localeCompare(a.name, 'zh-CN');
        case 'size-asc': return a.size - b.size;
        case 'size-desc': return b.size - a.size;
        case 'time-asc': return a.lastModified - b.lastModified;
        case 'time-desc': return b.lastModified - a.lastModified;
        default: return 0;
      }
    });

    const newFiles: MarkdownFile[] = [];
    let unlockedIndex = 0;
    for (let i = 0; i < files.length; i++) {
      if (lockedIndices.has(i)) {
        newFiles.push(files[i]);
      } else {
        newFiles.push(unlockedFiles[unlockedIndex++]);
      }
    }
    setFiles(newFiles);
  };

  const handleManualMove = (fromIndex: number, targetIndex: number) => {
    if (fromIndex === targetIndex) return;
    if (files[fromIndex].isLocked) return;

    const lockedIndices = new Set<number>();
    const unlockedFiles: MarkdownFile[] = [];
    const unlockedOriginalIndices: number[] = [];

    files.forEach((file, i) => {
      if (file.isLocked) {
        lockedIndices.add(i);
      } else {
        unlockedFiles.push(file);
        unlockedOriginalIndices.push(i);
      }
    });

    const fromUnlockedIndex = unlockedOriginalIndices.indexOf(fromIndex);
    if (fromUnlockedIndex === -1) return;

    let toUnlockedIndex;
    if (targetIndex >= files.length) {
      toUnlockedIndex = unlockedFiles.length;
    } else {
      toUnlockedIndex = files.slice(0, targetIndex).filter(f => !f.isLocked).length;
    }

    const [movedItem] = unlockedFiles.splice(fromUnlockedIndex, 1);
    
    if (fromUnlockedIndex < toUnlockedIndex) {
      toUnlockedIndex--;
    }

    unlockedFiles.splice(toUnlockedIndex, 0, movedItem);

    const newFiles: MarkdownFile[] = [];
    let unlockedIdx = 0;
    for (let i = 0; i < files.length; i++) {
      if (lockedIndices.has(i)) {
        newFiles.push(files[i]);
      } else {
        newFiles.push(unlockedFiles[unlockedIdx++]);
      }
    }
    setFiles(newFiles);
  };

  // Drag and Drop Handlers
  const onDragStart = (e: React.DragEvent, index: number, source: 'main' | 'staged' = 'main') => {
    if (source === 'main' && files[index].isLocked) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    setDragSource(source);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setDraggedIndex(index), 0);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    if (dragSource === 'main' && draggedIndex === index) {
      setDropIndicator(null);
      return;
    }
    if (files[index].isLocked) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isGrid = isExpanded;
    
    let position: 'before' | 'after' = 'before';
    if (isGrid) {
      const midX = rect.left + rect.width / 2;
      position = e.clientX < midX ? 'before' : 'after';
    } else {
      const midY = rect.top + rect.height / 2;
      position = e.clientY < midY ? 'before' : 'after';
    }
    
    setDropIndicator({ index, position });
    setDragOverIndex(index);
  };

  const onDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropIndicator(null);
    setDragSource(null);
    setIsDraggingToStaged(false);
  };

  const onDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex === null) return;
    
    let targetIndex = index;
    if (dropIndicator) {
      targetIndex = dropIndicator.position === 'after' ? index + 1 : index;
    }

    if (dragSource === 'main') {
      handleManualMove(draggedIndex, targetIndex);
    } else if (dragSource === 'staged') {
      const fileToMove = stagedFiles[draggedIndex];
      const newStaged = stagedFiles.filter((_, i) => i !== draggedIndex);
      
      const newFiles = [...files];
      newFiles.splice(targetIndex, 0, fileToMove);
      
      setStagedFiles(newStaged);
      setFiles(newFiles);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropIndicator(null);
    setDragSource(null);
  };

  const demoteHeadings = (content: string, demoteBy: number): string => {
    if (demoteBy <= 0) return content;
    const prefix = '#'.repeat(demoteBy);
    const lines = content.split('\n');
    let inCodeBlock = false;
    return lines.map(line => {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        return line;
      }
      if (!inCodeBlock) {
        const match = line.match(/^(#+)\s+(.*)/);
        if (match) {
          return `${prefix}${match[1]} ${match[2]}`;
        }
      }
      return line;
    }).join('\n');
  };

  const handleMerge = () => {
    let result = '';
    files.forEach((file, index) => {
      if (keepTitle) {
        const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
        const headingPrefix = '#'.repeat(titleLevel);
        result += `${headingPrefix} ${title}\n\n`;
        result += demoteHeadings(file.content, titleLevel);
      } else {
        result += file.content;
      }
      
      if (index < files.length - 1) {
        result += '\n\n---\n\n';
      }
    });
    startTransition(() => {
      setMergedContent(result);
    });
  };

  useEffect(() => {
    handleMerge();
  }, [files, keepTitle, titleLevel]);

  const generateDefaultFileName = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}_合并${files.length}个文件.md`;
  };

  const handleDownloadClick = () => {
    if (!mergedContent || files.length === 0) return;
    if (stagedFiles.length > 0) {
      setShowStagedWarning(true);
    } else {
      setExportFileName(generateDefaultFileName());
      setShowExportModal(true);
    }
  };

  const handleAppDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounter.current += 1;
      setIsDraggingOverApp(true);
    }
  };

  const handleAppDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDraggingOverApp(false);
      }
    }
  };

  const handleAppDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOverApp(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  };

  const handleStagedWarningAction = (action: 'append' | 'ignore') => {
    if (action === 'append') {
      const newFiles = [...files, ...stagedFiles];
      setFiles(newFiles);
      setStagedFiles([]);
      
      // Generate filename based on new length
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setExportFileName(`${yyyy}${mm}${dd}_${hh}${min}${ss}_合并${newFiles.length}个文件.md`);
    } else {
      setExportFileName(generateDefaultFileName());
    }
    setShowStagedWarning(false);
    setShowExportModal(true);
  };

  const confirmDownload = () => {
    if (!mergedContent) return;
    const blob = new Blob([mergedContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    let finalName = exportFileName.trim();
    if (!finalName) {
      finalName = generateDefaultFileName();
    } else if (!finalName.toLowerCase().endsWith('.md') && !finalName.toLowerCase().endsWith('.txt')) {
      finalName += '.md';
    }
    
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // --- Render Helpers ---

  const renderToolbar = () => (
    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-neutral-200 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            onChange={(e) => {
              handleSort(e.target.value as SortType);
              e.target.value = "";
            }}
            className="appearance-none text-xs font-medium border border-neutral-200 rounded-md pl-2.5 pr-7 py-1.5 bg-neutral-50 hover:border-indigo-300 outline-none focus:border-indigo-500 transition-colors text-neutral-700 cursor-pointer"
          >
            <option value="">自动排序...</option>
            <option value="name-asc">名称 (A-Z)</option>
            <option value="name-desc">名称 (Z-A)</option>
            <option value="size-asc">大小 (从小到大)</option>
            <option value="size-desc">大小 (从大到小)</option>
            <option value="time-desc">修改时间 (最新)</option>
            <option value="time-asc">修改时间 (最旧)</option>
          </select>
          <ArrowUpDown className="w-3 h-3 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button
          onClick={toggleAllLocks}
          className={cn(
            "p-1.5 rounded-md border transition-colors",
            allLocked 
              ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100" 
              : "bg-neutral-50 border-neutral-200 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
          )}
          title={allLocked ? "全部解锁" : "全部锁定 (防止自动排序时改变位置)"}
        >
          {allLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
      </div>
      
      <button
        onClick={() => setShowClearConfirm(true)}
        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 font-medium border border-transparent hover:border-red-200"
        title="清空全部文件"
      >
        <Trash2 className="w-3.5 h-3.5" />
        清空
      </button>
    </div>
  );

  const renderFileList = (isGrid: boolean) => {
    const getDropPosition = (index: number) => {
      if (dropIndicator?.index === index) return dropIndicator.position;
      return null;
    };

    return (
      <div 
        className={cn(
          "overflow-y-auto pr-1 pb-2",
          isGrid ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 content-start" : "space-y-2 flex-1"
        )}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragSource === 'staged' && draggedIndex !== null) {
            const fileToMove = stagedFiles[draggedIndex];
            const newStaged = stagedFiles.filter((_, i) => i !== draggedIndex);
            setStagedFiles(newStaged);
            setFiles([...files, fileToMove]);
            setDraggedIndex(null);
            setDragSource(null);
          }
        }}
      >
        {files.map((file, index) => {
          const dropPosition = getDropPosition(index);
          return (
            <div
              key={file.id}
              draggable={!file.isLocked}
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={onDragEnd}
              onDrop={(e) => onDrop(e, index)}
              className={cn(
                "relative flex flex-col pt-4 pb-3 px-3 rounded-xl border transition-all group",
                file.isLocked 
                  ? "bg-amber-50/30 border-amber-100" 
                  : "bg-white border-neutral-200 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50 cursor-grab active:cursor-grabbing",
                draggedIndex === index && dragSource === 'main' ? "opacity-40 scale-[0.98]" : "opacity-100",
                isGrid ? "h-[88px]" : ""
              )}
            >
              {dropPosition === 'before' && (
                <div className={cn(
                  "absolute bg-indigo-500 z-10 rounded-full",
                  isGrid ? "-left-[9px] top-0 bottom-0 w-[3px]" : "-top-[5px] left-0 right-0 h-[3px]"
                )} />
              )}
              {dropPosition === 'after' && (
                <div className={cn(
                  "absolute bg-indigo-500 z-10 rounded-full",
                  isGrid ? "-right-[9px] top-0 bottom-0 w-[3px]" : "-bottom-[5px] left-0 right-0 h-[3px]"
                )} />
              )}
              <div className="absolute top-1.5 left-0 right-0 flex justify-center">
            <div className={cn(
              "h-1 w-12 rounded-full transition-colors",
              file.color ? file.color : "bg-neutral-200 group-hover:bg-neutral-300",
              file.isLocked ? "opacity-50" : ""
            )} />
          </div>
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 overflow-hidden flex-1">
              {file.isLocked && <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <span className={cn(
                "text-sm font-medium truncate",
                file.isLocked ? "text-neutral-600" : "text-neutral-800"
              )} title={file.name}>
                {file.name}
              </span>
            </div>
            <span className="shrink-0 bg-neutral-100 px-1.5 py-0.5 rounded text-[11px] text-neutral-500">{formatSize(file.size)}</span>
          </div>
          
          <div className="flex items-center justify-between pl-1 mt-1.5">
            <div className="flex items-center gap-1.5">
              {['bg-red-500', 'bg-amber-500', 'bg-green-500', ''].map(color => (
                <button 
                  key={color || 'none'} 
                  onClick={() => setFileColor(file.id, color)}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-transform hover:scale-110 border",
                    color ? color : "bg-neutral-200 border-neutral-300",
                    file.color === color ? "ring-2 ring-offset-1 ring-neutral-400" : "border-transparent"
                  )} 
                  title={color ? "标记颜色" : "清除标记"}
                />
              ))}
            </div>
            
            <span className="text-[10px] text-neutral-400 truncate mx-2 flex-1 text-center">{formatDate(file.lastModified)}</span>
            
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => startEditing(file)}
                className="p-1 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="浏览/编辑"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => moveToStaged(index)}
                className="p-1 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="移至暂存"
              >
                <Inbox className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => toggleLock(file.id)}
                className={cn(
                  "p-1 rounded transition-colors",
                  file.isLocked 
                    ? "text-amber-500 bg-amber-100/50 hover:bg-amber-100" 
                    : "text-neutral-400 hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100"
                )}
                title={file.isLocked ? "解锁" : "锁定位置"}
              >
                {file.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => removeFile(file.id)}
                className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    })}
    </div>
  );
};

  const renderEmptyState = () => (
    <div 
      className="flex-1 flex flex-col items-center justify-center text-neutral-400 pb-10"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragSource === 'staged' && draggedIndex !== null) {
          const fileToMove = stagedFiles[draggedIndex];
          const newStaged = stagedFiles.filter((_, i) => i !== draggedIndex);
          setStagedFiles(newStaged);
          setFiles([fileToMove]);
          setDraggedIndex(null);
          setDragSource(null);
        }
      }}
    >
      <FileText className="w-16 h-16 mb-4 opacity-20" />
      <p className="text-sm font-medium mb-4">暂无文件，请添加</p>
      <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm mb-2">
        <Upload className="w-4 h-4" />导入本地文件
      </button>
      <p className="text-xs opacity-70">或直接拖拽文件到窗口中</p>
    </div>
  );

  const renderMergeOptions = () => (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-neutral-700 uppercase tracking-wider flex items-center gap-2">
        <Settings2 className="w-4 h-4" />
        合并选项
      </h2>
      
      <div className="flex flex-col gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative flex items-center justify-center mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={keepTitle}
              onChange={(e) => setKeepTitle(e.target.checked)}
              className="peer appearance-none w-5 h-5 border-2 border-neutral-300 rounded checked:bg-indigo-600 checked:border-indigo-600 transition-colors cursor-pointer"
            />
            <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-neutral-800 group-hover:text-indigo-700 transition-colors">
              保留文件名为标题
            </span>
            <span className="text-xs text-neutral-500 mt-1 leading-relaxed">
              在每个文件内容前插入文件名作为标题，并自动降级原文件中的标题。
            </span>
          </div>
        </label>

        {keepTitle && (
          <div className="ml-8 flex items-center gap-3 pt-3 border-t border-neutral-200/60">
            <span className="text-sm text-neutral-600">文件名标题级别:</span>
            <select
              value={titleLevel}
              onChange={(e) => setTitleLevel(Number(e.target.value) as 1 | 2 | 3)}
              className="text-sm border border-neutral-200 rounded-md px-2 py-1 bg-white hover:border-indigo-300 outline-none focus:border-indigo-500 transition-colors text-neutral-700 cursor-pointer"
            >
              <option value={1}>一级标题 (H1)</option>
              <option value={2}>二级标题 (H2)</option>
              <option value={3}>三级标题 (H3)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div 
      className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex overflow-hidden"
      onDragEnter={handleAppDragEnter}
      onDragLeave={handleAppDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleAppDrop}
    >
      <input
        type="file"
        multiple
        accept=".md,.markdown,.txt"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      {isDraggingOverApp && (
        <div className="fixed inset-0 bg-indigo-600/90 z-[100] flex flex-col items-center justify-center text-white border-8 border-indigo-400 border-dashed m-4 rounded-3xl pointer-events-none animate-in fade-in duration-200">
          <Upload className="w-24 h-24 mb-6 animate-bounce" />
          <h2 className="text-4xl font-bold mb-2">松开鼠标导入文件</h2>
          <p className="text-indigo-200 text-lg">支持 .md, .txt 格式</p>
        </div>
      )}
      {/* Left Panel (Sidebar in normal, Tools panel in fullscreen) */}
      <div className={cn(
        "bg-white border-r border-neutral-200 flex flex-col h-screen shrink-0 shadow-sm z-20 transition-all duration-300 ease-in-out",
        isExpanded ? "w-80" : "w-full md:w-96"
      )}>
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 bg-white shrink-0 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <FilePlus className="w-6 h-6 text-indigo-600" />
              MD 合并工具
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              批量合并、排序与管理
            </p>
          </div>
          {!isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2.5 rounded-lg transition-colors hidden md:flex items-center gap-2 border text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 border-transparent hover:border-indigo-100"
              title="全屏管理文件"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className={cn(
          "flex flex-col flex-1 overflow-y-auto",
          isExpanded ? "p-5 gap-6" : "p-5 bg-neutral-50/30"
        )}>
          {/* Toolbar */}
          {files.length > 0 && (
            <div className={cn("shrink-0", !isExpanded && "mb-3")}>
              {renderToolbar()}
            </div>
          )}

          {/* File List (Normal Mode Only) */}
          {!isExpanded && (
            <div className="flex flex-col flex-1 min-h-0 mt-2">
              {files.length > 0 ? renderFileList(false) : renderEmptyState()}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel (Preview in normal, File Grid in fullscreen) */}
      <div className={cn(
        "flex-col h-screen overflow-hidden bg-neutral-100/50 transition-all duration-300 ease-in-out",
        isExpanded ? "flex-1 flex" : "flex-1 hidden md:flex"
      )}>
        {isExpanded ? (
          /* Fullscreen Mode: File Grid */
          <>
            <div className="h-16 border-b border-neutral-200 px-6 flex items-center justify-between shrink-0 bg-white shadow-sm z-10 gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <h2 className="text-base font-semibold text-neutral-800">
                  文件列表 ({files.length})
                </h2>
              </div>
              
              {/* Compact Staging Area in Header */}
              <div 
                className={cn(
                  "flex-1 flex items-center gap-2 overflow-x-auto px-4 py-2 rounded-lg border-2 transition-all min-w-0 custom-scrollbar",
                  isDraggingToStaged ? "border-amber-400 bg-amber-50" : "border-dashed border-neutral-200 bg-neutral-50"
                )}
                onDragOver={(e) => { 
                  e.preventDefault(); 
                  if (dragSource === 'main') setIsDraggingToStaged(true); 
                }}
                onDragLeave={() => setIsDraggingToStaged(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingToStaged(false);
                  if (draggedIndex !== null && dragSource === 'main') {
                    moveToStaged(draggedIndex);
                    setDraggedIndex(null);
                    setDragSource(null);
                  }
                }}
              >
                <div className="flex items-center gap-1.5 shrink-0 text-amber-600 mr-2">
                  <Inbox className="w-4 h-4" />
                  <span className="text-sm font-medium">暂存栏 ({stagedFiles.length})</span>
                </div>
                
                {stagedFiles.length === 0 ? (
                  <span className="text-xs text-neutral-400 italic">拖拽文件到此处暂存</span>
                ) : (
                  <div className="flex gap-2 items-center">
                    {stagedFiles.map((file, index) => (
                      <div 
                        key={file.id} 
                        draggable
                        onDragStart={(e) => onDragStart(e, index, 'staged')}
                        onDragEnd={onDragEnd}
                        className={cn(
                          "relative overflow-hidden flex items-center gap-2 bg-white border border-amber-200 rounded-md px-2 py-1.5 pt-2.5 shrink-0 shadow-sm max-w-[150px] cursor-grab active:cursor-grabbing transition-all",
                          draggedIndex === index && dragSource === 'staged' ? "opacity-40 scale-[0.98]" : "opacity-100"
                        )}
                      >
                        <div className="absolute top-1 left-0 right-0 flex justify-center">
                          <div className={cn(
                            "h-0.5 w-6 rounded-full transition-colors",
                            file.color ? file.color : "bg-amber-200"
                          )} />
                        </div>
                        <span className="text-xs text-neutral-700 truncate flex-1" title={file.name}>{file.name}</span>
                        <div className="flex items-center gap-0.5 border-l border-amber-100 pl-1 shrink-0">
                          <button onClick={() => startEditing(file)} className="p-0.5 hover:bg-amber-100 rounded text-amber-600 transition-colors" title="浏览/编辑">
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button onClick={() => moveToMain(index)} className="p-0.5 hover:bg-amber-100 rounded text-amber-600 transition-colors" title="移入合并列表">
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm">
                  <Upload className="w-4 h-4" />导入文件
                </button>
                <button onClick={() => setShowMergeOptionsModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm">
                  <Settings2 className="w-4 h-4" />合并选项
                </button>
                <button onClick={handleDownloadClick} disabled={files.length === 0} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-200">
                  <Download className="w-4 h-4" />导出合并文件
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200 shrink-0 ml-2"
                >
                  <Minimize2 className="w-4 h-4" />
                  退出全屏
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-neutral-50/50">
              {files.length > 0 ? renderFileList(true) : renderEmptyState()}
            </div>
          </>
        ) : (
          /* Normal Mode: Preview/Editor */
          <>
            <div className="h-16 border-b border-neutral-200 px-6 flex items-center justify-between shrink-0 bg-white shadow-sm z-10">
              <div className="flex items-center gap-1.5 bg-neutral-100/80 p-1 rounded-lg border border-neutral-200/60">
                <button onClick={() => setPreviewMode('raw')} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all", previewMode === 'raw' ? "bg-white text-indigo-700 shadow-sm border border-neutral-200/50" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50 border border-transparent")}>
                  <Code className="w-4 h-4" />源码 (Raw)
                </button>
                <button onClick={() => setPreviewMode('rendered')} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all", previewMode === 'rendered' ? "bg-white text-indigo-700 shadow-sm border border-neutral-200/50" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50 border border-transparent")}>
                  <Eye className="w-4 h-4" />预览 (Preview)
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm">
                  <Upload className="w-4 h-4" />导入文件
                </button>
                <button onClick={() => setShowMergeOptionsModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm">
                  <Settings2 className="w-4 h-4" />合并选项
                </button>
                <button onClick={handleDownloadClick} disabled={files.length === 0} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-200">
                  <Download className="w-4 h-4" />导出合并文件
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {files.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 bg-white">
                  <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mb-5 shadow-inner border border-neutral-100">
                    <FileText className="w-8 h-8 text-neutral-300" />
                  </div>
                  <p className="text-base font-medium text-neutral-600 mb-1.5">预览区</p>
                  <p className="text-xs">在左侧添加文件后，这里将显示合并后的内容</p>
                </div>
              ) : previewMode === 'raw' ? (
                <textarea value={mergedContent} onChange={(e) => setMergedContent(e.target.value)} className="w-full h-full p-6 resize-none outline-none font-mono text-sm text-neutral-800 bg-white leading-relaxed" placeholder="合并后的 Markdown 源码..." spellCheck={false} />
              ) : (
                <div className="w-full h-full overflow-y-auto p-6 md:p-10">
                  <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-xl shadow-sm border border-neutral-200 min-h-full">
                    <div className="markdown-body prose prose-neutral prose-indigo max-w-none prose-headings:font-semibold prose-a:text-indigo-600 hover:prose-a:text-indigo-500 [&>*]:[content-visibility:auto]">
                      <MemoizedMarkdown content={deferredMergedContent} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Clear Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">清空所有文件</h3>
            <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
              确定要清空列表中的所有文件吗？此操作无法撤销，您需要重新上传文件。
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)} 
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => { setFiles([]); setShowClearConfirm(false); }} 
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm shadow-red-200"
              >
                确定清空
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
              <Download className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">导出合并文件</h3>
            <p className="text-neutral-500 text-sm mb-4 leading-relaxed">
              请输入要保存的文件名。默认名称已根据当前时间和合并文件数量生成。
            </p>
            
            <div className="mb-6">
              <label htmlFor="exportFileName" className="block text-sm font-medium text-neutral-700 mb-1.5">
                文件名
              </label>
              <input
                id="exportFileName"
                type="text"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-neutral-900"
                placeholder="例如: my_merged_document.md"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmDownload();
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowExportModal(false)} 
                className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmDownload} 
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm shadow-indigo-200"
              >
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Options Modal */}
      {showMergeOptionsModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-600" />
                合并选项
              </h3>
              <button onClick={() => setShowMergeOptionsModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderMergeOptions()}
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowMergeOptionsModal(false)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staged Warning Modal */}
      {showStagedWarning && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">暂存栏还有文件未处理</h3>
            <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
              您的暂存栏中还有 {stagedFiles.length} 个文件。在导出合并文件前，您希望如何处理它们？
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleStagedWarningAction('append')} 
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                追加到合并列表末尾并导出
              </button>
              <button 
                onClick={() => handleStagedWarningAction('ignore')} 
                className="w-full px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                忽略暂存文件，直接导出
              </button>
              <button 
                onClick={() => setShowStagedWarning(false)} 
                className="w-full px-4 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors mt-2"
              >
                取消，我再整理一下
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single File Edit Modal */}
      {editingFileId && (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-in fade-in duration-200">
          <div className="h-14 border-b border-neutral-200 flex items-center justify-between px-4 bg-neutral-50 shrink-0 shadow-sm">
            <div className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-600" />
              <span className="font-medium text-neutral-800">
                编辑文件: {files.find(f => f.id === editingFileId)?.name || stagedFiles.find(f => f.id === editingFileId)?.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors">
                <X className="w-4 h-4" /> 取消
              </button>
              <button onClick={saveEdit} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">
                <Check className="w-4 h-4" /> 保存更改
              </button>
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col border-r border-neutral-200">
              <div className="h-10 bg-neutral-100 border-b border-neutral-200 flex items-center px-4 shrink-0">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Markdown 源码</span>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 p-6 resize-none outline-none font-mono text-sm text-neutral-800 bg-white leading-relaxed"
                spellCheck={false}
              />
            </div>
            <div className="flex-1 flex flex-col bg-neutral-50">
              <div className="h-10 bg-neutral-100 border-b border-neutral-200 flex items-center px-4 shrink-0">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">实时预览</span>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <div className="markdown-body prose prose-neutral prose-indigo max-w-none [&>*]:[content-visibility:auto]">
                  <MemoizedMarkdown content={deferredEditContent} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
