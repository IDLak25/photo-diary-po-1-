import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DiaryEntry } from './types';

// Let TypeScript know about JSZip from the CDN
declare const JSZip: any;

// SVG Icons
const CameraIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const BookOpenIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
);

const SaveIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const UploadIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);

const DownloadIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);


const App: React.FC = () => {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [note, setNote] = useState<string>('');
    const [entries, setEntries] = useState<DiaryEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
    const [lastCapture, setLastCapture] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [cameraInitialized, setCameraInitialized] = useState<boolean>(false);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [installPrompt, setInstallPrompt] = useState<any>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            const savedEntriesJSON = localStorage.getItem('photoDiaryEntries');
            if (savedEntriesJSON) {
                const loadedEntries: DiaryEntry[] = JSON.parse(savedEntriesJSON).map((entry: any) => ({
                    ...entry,
                    timestamp: new Date(entry.timestamp),
                }));
                setEntries(loadedEntries);
            }
        } catch (err) {
            console.error("Error loading entries from localStorage:", err);
            localStorage.removeItem('photoDiaryEntries');
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('photoDiaryEntries', JSON.stringify(entries));
        } catch (err) {
            console.error("Error saving entries to localStorage:", err);
        }
    }, [entries]);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const initializeCamera = useCallback(async () => {
        setPermissionError(null);
        setError(null);
        try {
            // This prompts for permission.
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop()); // Stop stream immediately
            
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
            setDevices(videoDevices);

            if (videoDevices.length > 0) {
                setCameraInitialized(true);
                const savedDeviceId = localStorage.getItem('photoDiarySelectedDeviceId');
                if (savedDeviceId && videoDevices.some(d => d.deviceId === savedDeviceId)) {
                    setSelectedDeviceId(savedDeviceId);
                } else {
                    setSelectedDeviceId(videoDevices[0].deviceId);
                }
            } else {
                setPermissionError("No camera found on this device.");
                setCameraInitialized(false);
            }
        } catch (err) {
            console.error("Error accessing media devices.", err);
            let message = "Could not access camera. Please ensure it's not in use by another app and that you've granted permission in your browser settings.";
            if (err instanceof DOMException) {
                if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                    message = "Camera permission denied. To use this app, please grant camera access. You can usually do this by clicking the lock icon next to the address bar.";
                } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                    message = "No camera found on this device.";
                }
            }
            setPermissionError(message);
            setCameraInitialized(false);
        }
    }, []);

    useEffect(() => {
        if (selectedDeviceId) {
            localStorage.setItem('photoDiarySelectedDeviceId', selectedDeviceId);
            stopStream();
            const constraints = {
                video: { deviceId: { exact: selectedDeviceId } }
            };
            navigator.mediaDevices.getUserMedia(constraints)
                .then(stream => {
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        setIsCameraOn(true);
                        setError(null);
                    }
                })
                .catch(err => {
                    console.error("Error starting camera stream:", err);
                    setError("Could not start camera. It might be in use by another application.");
                    setIsCameraOn(false);
                });
        }
        return () => {
            stopStream();
        };
    }, [selectedDeviceId]);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !note.trim()) {
            if (!note.trim()){
                alert("Please enter a note before capturing a photo.");
            }
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageUrl = canvas.toDataURL('image/jpeg');
        const timestamp = new Date();
        
        const newEntry: DiaryEntry = { id: timestamp.toISOString(), note, imageUrl, timestamp };
        setEntries(prev => [newEntry, ...prev]);
        setLastCapture(imageUrl);

        setTimeout(() => setLastCapture(null), 300);

    }, [note]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                event.preventDefault();
                capturePhoto();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [capturePhoto]);

    const handleSaveAll = async () => {
        if (entries.length === 0 || isSaving) return;
    
        setIsSaving(true);
        setError(null);
        try {
            const zip = new JSZip();
            const folder = zip.folder("PO Diario");
            if (!folder) throw new Error("Could not create folder in zip.");

            const metadata: {id: string, note: string, timestamp: string, filename: string}[] = [];
    
            entries.forEach(entry => {
                const timestamp = entry.timestamp;
                const safeNote = entry.note.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'entry';
                const dateStr = timestamp.toISOString().split('T')[0];
                const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
                const filename = `${safeNote}_${dateStr}_${timeStr}.jpg`;
    
                const imgData = entry.imageUrl.split(',')[1];
                folder.file(filename, imgData, { base64: true });
                metadata.push({ id: entry.id, note: entry.note, timestamp: entry.timestamp.toISOString(), filename });
            });

            zip.file("metadata.json", JSON.stringify(metadata, null, 2));
    
            const zipBlob = await zip.generateAsync({ type: "blob" });
    
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = 'PO_Diario.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
    
        } catch (err) {
            console.error("Error creating zip file:", err);
            setError("Could not create the diary archive. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleImportTrigger = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        setIsImporting(true);
        setError(null);
        try {
            const zip = await JSZip.loadAsync(file);
    
            const metadataFile = zip.file("metadata.json");
            if (!metadataFile) throw new Error("Invalid Diary Archive: metadata.json not found.");
            
            const metadataContent = await metadataFile.async("string");
            const metadata = JSON.parse(metadataContent);
            if (!Array.isArray(metadata)) throw new Error("Invalid Diary Archive: metadata.json is corrupted.");
    
            const diaryFolder = zip.folder("PO Diario");
            if (!diaryFolder) throw new Error("Invalid Diary Archive: 'PO Diario' folder not found.");
            
            const newEntries: DiaryEntry[] = [];
            const existingIds = new Set(entries.map(e => e.id));
    
            for (const item of metadata) {
                if (existingIds.has(item.id)) continue;
    
                const imageFile = diaryFolder.file(item.filename);
                if (!imageFile) {
                    console.warn(`Image file not found for entry ${item.id}: ${item.filename}`);
                    continue;
                }
                
                const imageBase64 = await imageFile.async("base64");
                const imageUrl = `data:image/jpeg;base64,${imageBase64}`;
                
                newEntries.push({
                    id: item.id,
                    note: item.note,
                    imageUrl: imageUrl,
                    timestamp: new Date(item.timestamp)
                });
            }
            
            setEntries(prev => [...prev, ...newEntries].sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()));
    
        } catch (err) {
            console.error("Error importing zip file:", err);
            setError(err instanceof Error ? err.message : "Could not import the diary archive.");
        } finally {
            setIsImporting(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleInstallClick = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        setInstallPrompt(null);
    };

    const uniqueNotesData = useMemo(() => {
        const groupedByNote = entries.reduce((acc, entry) => {
            if (!acc[entry.note]) {
                acc[entry.note] = [];
            }
            acc[entry.note].push(entry);
            return acc;
        }, {} as Record<string, DiaryEntry[]>);

        return Object.entries(groupedByNote)
            .map(([note, noteEntries]) => ({
                note,
                count: noteEntries.length,
                lastTimestamp: noteEntries[0].timestamp,
            }))
            .sort((a, b) => b.lastTimestamp.getTime() - a.lastTimestamp.getTime());
    }, [entries]);

    return (
        <div className="flex h-screen bg-gray-900 font-sans">
            <aside className="w-1/3 max-w-sm flex flex-col bg-gray-800 p-6 border-r border-gray-700">
                <div className="flex items-center mb-6">
                    <BookOpenIcon className="w-8 h-8 text-cyan-400" />
                    <h1 className="ml-3 text-2xl font-bold text-white">PO Diario</h1>
                </div>
                <div className="flex-grow overflow-y-auto pr-2">
                    {uniqueNotesData.length === 0 ? (
                        <div className="text-center text-gray-400 mt-10">
                            <p>No entries yet.</p>
                            <p className="text-sm">Capture a photo to start your diary.</p>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {uniqueNotesData.map(({ note, count, lastTimestamp }) => (
                                <li key={note} className="bg-gray-700 p-4 rounded-lg shadow-md hover:bg-gray-600 transition-colors duration-200">
                                    <div className="flex justify-between items-center gap-4">
                                        <p className="font-semibold text-white truncate" title={note}>{note}</p>
                                        <span className="flex-shrink-0 text-xs font-mono bg-cyan-900/50 text-cyan-300 px-2 py-1 rounded-full">{count}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Latest: {lastTimestamp.toLocaleString()}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="mt-6 pt-6 border-t border-gray-700 space-y-3">
                    {installPrompt && (
                         <button
                            onClick={handleInstallClick}
                            className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
                            aria-label="Install Photo Diary App"
                        >
                            <DownloadIcon className="w-6 h-6" />
                            <span>Install App</span>
                        </button>
                    )}
                    <button
                        onClick={handleImportTrigger}
                        disabled={isImporting || isSaving}
                        className="w-full flex items-center justify-center gap-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500"
                        aria-label="Import diary entries from a zip file"
                    >
                        <UploadIcon className="w-6 h-6" />
                        <span>{isImporting ? 'Importing...' : 'Import from .zip'}</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportFile}
                        className="hidden"
                        accept=".zip,application/zip"
                    />
                    <button
                        onClick={handleSaveAll}
                        disabled={entries.length === 0 || isSaving || isImporting}
                        className="w-full flex items-center justify-center gap-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500"
                        aria-label="Save all diary entries as a zip file"
                    >
                        <SaveIcon className="w-6 h-6" />
                        <span>{isSaving ? 'Saving...' : 'Save Diary as .zip'}</span>
                    </button>
                </div>
            </aside>
            
            <main className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-900 relative">
                 {error && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-4xl bg-red-800/90 border border-red-600 text-white p-3 rounded-lg shadow-lg z-10 flex justify-between items-center animate-fade-in">
                        <p className="flex-grow">{error}</p>
                        <button onClick={() => setError(null)} className="ml-4 p-1 rounded-full hover:bg-red-700 text-2xl leading-none">&times;</button>
                        <style>{`
                            @keyframes fade-in {
                                from { opacity: 0; transform: translateY(-10px) translateX(-50%); }
                                to { opacity: 1; transform: translateY(0) translateX(-50%); }
                            }
                            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                        `}</style>
                    </div>
                )}
                <div className="w-full max-w-4xl space-y-6">
                    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                        <label htmlFor="camera-select" className="flex items-center text-lg font-medium text-white">
                            <CameraIcon className="w-6 h-6 mr-3 text-cyan-400"/>
                            Select Camera
                        </label>
                        <select
                            id="camera-select"
                            value={selectedDeviceId}
                            onChange={(e) => setSelectedDeviceId(e.target.value)}
                            disabled={!cameraInitialized || devices.length === 0}
                            className="mt-2 block w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                            {devices.length === 0 && <option>{cameraInitialized ? 'No cameras found' : 'Enable camera to see list'}</option>}
                            {devices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${devices.indexOf(device) + 1}`}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative w-full aspect-video bg-black rounded-lg shadow-lg overflow-hidden border-2 border-gray-700">
                        {cameraInitialized ? (
                            <>
                                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity duration-300 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`}/>
                                {!isCameraOn && (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                        <p>Starting camera...</p>
                                    </div>
                                )}
                                {lastCapture && (
                                    <div className="absolute inset-0 bg-white opacity-70 animate-ping-once" style={{animation: 'ping-once 0.3s cubic-bezier(0, 0, 0.2, 1)'}}></div>
                                )}
                                <style>{`
                                    @keyframes ping-once {
                                        75%, 100% {
                                            transform: scale(2);
                                            opacity: 0;
                                        }
                                    }
                                `}</style>
                            </>
                        ) : (
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                {permissionError ? (
                                    <>
                                        <p className="text-lg text-red-400 mb-4">{permissionError}</p>
                                        <button 
                                            onClick={initializeCamera}
                                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                                        >
                                            Try Again
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <CameraIcon className="w-16 h-16 text-gray-500 mb-4"/>
                                        <h2 className="text-2xl font-bold text-white mb-2">Ready to capture your day?</h2>
                                        <p className="mb-6">Click the button below to start your camera.</p>
                                        <button 
                                            onClick={initializeCamera}
                                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 text-lg"
                                        >
                                            Start Camera
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                       <label htmlFor="photo-note" className="text-lg font-medium text-white">Photo Note (PO)</label>
                        <input
                            id="photo-note"
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            disabled={!isCameraOn}
                            placeholder={isCameraOn ? "Enter a note for your photo..." : "Start camera to add a note"}
                            className="mt-2 block w-full bg-gray-700 border border-gray-600 text-white rounded-md p-3 focus:ring-cyan-500 focus:border-cyan-500 placeholder-gray-400 disabled:bg-gray-800 disabled:cursor-not-allowed"
                        />
                         <p className="mt-2 text-sm text-gray-400">
                            Press the <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-200 bg-gray-600 border border-gray-500 rounded-lg">Spacebar</kbd> key to capture the photo.
                        </p>
                    </div>
                </div>
            </main>

            <canvas ref={canvasRef} className="hidden"></canvas>
        </div>
    );
};

export default App;
