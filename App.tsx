
import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { Timeline } from './components/Timeline';
import { ReportDisplay } from './components/ReportDisplay';
import { RegistrationForm } from './components/RegistrationForm';
import { analyzeDocumentsMetadata, generateMedicalReport } from './services/geminiService';
import { saveDocumentsToStorage, loadDocumentsFromStorage, clearDocumentsStorage, removeDocumentFromStorage } from './services/storageService';
import { AppStep, ProcessedDocument, ReportData, PatientProfile } from './types';
import { Loader2, ArrowRight, LayoutDashboard, RefreshCcw, Key } from 'lucide-react';

const STORAGE_KEY_PROFILE = 'medichronicle_profile';

// window.aistudio is globally defined in the environment; local declaration is removed to prevent type conflicts.

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.REGISTRATION);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const initApp = async () => {
      try {
        // Check for API key status in AI Studio environment
        if ((window as any).aistudio) {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        }

        const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
        if (savedProfile) {
          setProfile(JSON.parse(savedProfile));
          const savedDocs = await loadDocumentsFromStorage();
          if (savedDocs && savedDocs.length > 0) {
            setDocuments(savedDocs);
            setStep(AppStep.REVIEW);
          } else {
            setStep(AppStep.UPLOAD);
          }
        }
      } catch (err) {
        console.error("Hydration failed", err);
      } finally {
        setIsInitializing(false);
      }
    };
    initApp();
  }, []);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true); // Assume success per race condition guidelines
      setError(null);
    }
  };

  const handleProfileComplete = (newProfile: PatientProfile) => {
    setProfile(newProfile);
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(newProfile));
    setStep(AppStep.UPLOAD);
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!hasApiKey && (window as any).aistudio) {
      setError("Please connect your API key first using the button below.");
      return;
    }

    setError(null);
    setStep(AppStep.ANALYZING_METADATA);
    setAnalysisProgress({ current: 0, total: files.length });

    try {
      const metaData = await analyzeDocumentsMetadata(files, (current, total) => {
        setAnalysisProgress({ current, total });
      });

      const processed: ProcessedDocument[] = metaData.map((meta, index) => ({
        ...meta,
        file: files[index],
        previewUrl: URL.createObjectURL(files[index])
      }));

      await saveDocumentsToStorage(processed);
      setDocuments(processed);
      setStep(AppStep.REVIEW);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      if (msg.includes("403") || msg.includes("permission")) {
        setError("API Permission Error: Your API key session may have expired. Please reconnect your key.");
        setHasApiKey(false);
      } else {
        setError(msg);
      }
      setStep(AppStep.UPLOAD);
    }
  };

  const handleRemoveDocument = async (id: string) => {
    const updated = documents.filter(d => d.id !== id);
    setDocuments(updated);
    await removeDocumentFromStorage(id);
  };

  const handleGenerateReport = async () => {
    setStep(AppStep.GENERATING_REPORT);
    try {
      const reportData = await generateMedicalReport(documents);
      setReport(reportData);
      setStep(AppStep.RESULT);
    } catch (err: any) {
        setError("Report generation failed. Try reconnecting your API key.");
        setStep(AppStep.REVIEW);
    }
  };

  const handleReset = async () => {
    if (confirm("Clear all records?")) {
        await clearDocumentsStorage();
        setDocuments([]);
        setReport(null);
        setStep(AppStep.UPLOAD);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-medical-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-medical-600" />
            <span className="font-black text-xl tracking-tight">MediChronicle AI</span>
          </div>
          <div className="flex items-center gap-4">
            {!hasApiKey && (window as any).aistudio && (
              <button 
                onClick={handleSelectKey}
                className="text-[10px] font-black uppercase tracking-widest text-white bg-medical-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-medical-700 transition-colors"
              >
                <Key className="w-3 h-3" /> Connect Key
              </button>
            )}
            {profile && (
              <button onClick={handleReset} className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 hover:text-red-500 transition-colors">
                <RefreshCcw className="w-3 h-3" /> Clear Dossier
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl mb-8 flex flex-col gap-4">
            <p className="text-sm font-bold">{error}</p>
            {!hasApiKey && (window as any).aistudio && (
              <button 
                onClick={handleSelectKey}
                className="bg-red-600 text-white text-xs font-black uppercase tracking-widest py-3 px-6 rounded-xl self-start hover:bg-red-700 transition-all"
              >
                Reconnect API Key
              </button>
            )}
          </div>
        )}

        {step === AppStep.REGISTRATION && <RegistrationForm onComplete={handleProfileComplete} />}
        {step === AppStep.UPLOAD && <FileUpload onFilesSelected={handleFilesSelected} />}
        
        {step === AppStep.ANALYZING_METADATA && (
          <div className="text-center py-20 animate-in zoom-in duration-300">
            <div className="relative inline-block mb-8">
                <Loader2 className="w-16 h-16 animate-spin text-medical-500" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-medical-600">
                    {Math.round((analysisProgress.current / analysisProgress.total) * 100)}%
                </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Analyzing Medical Records</h3>
            <p className="text-slate-500 text-sm">Processing record {analysisProgress.current} of {analysisProgress.total}...</p>
            <div className="max-w-md mx-auto mt-8 bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                    className="bg-medical-500 h-full transition-all duration-500" 
                    style={{ width: `${(analysisProgress.current / (analysisProgress.total || 1)) * 100}%` }}
                />
            </div>
          </div>
        )}

        {step === AppStep.REVIEW && (
          <div className="grid lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <Timeline documents={documents} onRemove={handleRemoveDocument} />
            </div>
            <div className="sticky top-24 h-fit">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-2xl ring-1 ring-slate-100">
                <h4 className="font-black text-slate-900 uppercase tracking-tighter mb-4">Summary</h4>
                <div className="space-y-3 mb-8">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Records</span>
                        <span className="font-bold">{documents.length}</span>
                    </div>
                </div>
                <button 
                  onClick={handleGenerateReport}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                >
                  Synthesize History <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === AppStep.GENERATING_REPORT && (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-medical-600 mb-6" />
            <h3 className="text-xl font-black text-slate-900">Synthesizing Records</h3>
            <p className="text-slate-500 mt-2 text-sm">Generating long-form clinical synthesis...</p>
          </div>
        )}

        {step === AppStep.RESULT && report && (
          <ReportDisplay report={report} documents={documents} patientName={profile?.name} />
        )}
      </main>
    </div>
  );
};

export default App;
