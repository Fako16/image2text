import React, { useState, useRef } from 'react';
import { UploadCloud, X, FileText, Type, Copy, Check, Settings } from 'lucide-react';
import './index.css';

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const callGeminiApi = async (modelName, apiKey, base64Image, mimeType) => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: 'You are an expert at reading messy Bosnian/Serbo-Croatian handwriting. Please read the handwritten text in this image and return ONLY the extracted text. Do not add any conversational filler, markdown formatting, quotes, or explanations. Just the raw text. Pay close attention to diacritics like č, ć, đ, š, ž. If a word is illegible, do your best to guess based on the surrounding context.'
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    const errorMsg = errorData.error?.message || 'Failed to fetch from Gemini API';
    return { ok: false, status: response.status, message: errorMsg };
  }

  const data = await response.json();
  if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
    return { ok: true, text: data.candidates[0].content.parts[0].text.trim() };
  } else {
    return { ok: false, message: 'Could not extract text from the response.' };
  }
};

function App() {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');

  const [resultText, setResultText] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(() => !localStorage.getItem('gemini_api_key'));
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [tempApiKey, setTempApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [model, setModel] = useState(() => localStorage.getItem('gemini_model') || 'gemini-2.5-flash');
  const [tempModel, setTempModel] = useState(() => localStorage.getItem('gemini_model') || 'gemini-2.5-flash');

  const fileInputRef = useRef(null);

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', tempApiKey);
    localStorage.setItem('gemini_model', tempModel);
    setApiKey(tempApiKey);
    setModel(tempModel);
    setIsModalOpen(false);
  };

  const processImage = async (file) => {
    if (!apiKey) {
      setIsModalOpen(true);
      return;
    }

    setIsProcessing(true);
    setStatusText('Povezivanje sa Google Gemini...');
    setResultText('');

    try {
      const base64Image = await fileToBase64(file);

      setStatusText(`Analiza rukopisa (koristeći ${model})...`);
      let res = await callGeminiApi(model, apiKey, base64Image, file.type);

      // Ako je model preopterećen (503/429/high demand), pokušaj automatski fallback na drugi model
      if (!res.ok && 
          (res.status === 503 || res.status === 429 || res.message.toLowerCase().includes('demand') || res.message.toLowerCase().includes('limit'))) {
        const fallback = model === 'gemini-3.5-flash' ? 'gemini-2.5-flash' : 'gemini-3.5-flash';
        setStatusText(`Model preopterećen. Pokušavam ${fallback}...`);
        res = await callGeminiApi(fallback, apiKey, base64Image, file.type);
      }

      if (!res.ok) {
        throw new Error(res.message);
      }

      setResultText(res.text);
      setStatusText('Završeno!');
    } catch (error) {
      console.error(error);
      setStatusText(`Došlo je do greške: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImage(file);
    }
  };

  const handleImage = (file) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    processImage(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImage(file);
    }
  };

  const clearImage = () => {
    setPreviewUrl(null);
    setResultText('');
    setStatusText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="app-container">
      <button className="settings-btn" onClick={() => setIsModalOpen(true)} title="Postavke (API Ključ)">
        <Settings size={20} />
      </button>

      <header className="header">
        <h1>Prepoznavanje Rukopisa (AI)</h1>
        <p>Postavite sliku svog rukopisa na bosanskom jeziku, a naša stranica će ga pretvoriti u tekst.</p>
      </header>

      <main className="main-content">
        {/* Left Panel: Upload / Image Preview */}
        <div className="panel">
          {!previewUrl ? (
            <div
              className={`upload-zone ${isDragging ? 'drag-active' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="upload-icon" />
              <p className="upload-text">Kliknite ili prevucite sliku ovdje</p>
              <p className="upload-subtext">Podržani formati: JPG, PNG, WEBP</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div className="image-preview-container">
              <img src={previewUrl} alt="Uploaded preview" className="image-preview" />
              {!isProcessing && (
                <button className="remove-btn" onClick={clearImage} title="Ukloni sliku">
                  <X size={20} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Results */}
        <div className="panel">
          <div className="result-header">
            <h2 className="result-title">
              <Type size={20} className="text-accent" />
              Izdvojeni Tekst
            </h2>
            {resultText && !isProcessing && (
              <button className="btn btn-outline" onClick={copyToClipboard}>
                {isCopied ? <><Check size={16} /> Kopirano</> : <><Copy size={16} /> Kopiraj</>}
              </button>
            )}
          </div>

          {isProcessing ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p className="status-text">{statusText}</p>
            </div>
          ) : resultText ? (
            <textarea
              className="text-area"
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              placeholder="Prepoznati tekst će se pojaviti ovdje..."
            />
          ) : (
            <div className="empty-state">
              <FileText className="empty-icon" />
              <p>Rezultat će biti prikazan ovdje nakon obrade slike.</p>
            </div>
          )}
        </div>
      </main>

      {/* API Key Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Postavke (Google Gemini API Ključ)</h2>
              {apiKey && (
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  <X size={24} />
                </button>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Unesite vaš besplatni Gemini API ključ:</label>
              <input
                type="password"
                className="input-field"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="AIzaSy..."
              />
              <p className="help-text">
                Ovaj ključ je besplatan (putem Google AI Studio). Čuva se isključivo lokalno u vašem pretraživaču i šalje se direktno Google serverima radi analize slike.
              </p>
            </div>

            <div className="input-group">
              <label className="input-label">Izaberite AI Model:</label>
              <select
                className="input-field"
                value={tempModel}
                onChange={(e) => setTempModel(e.target.value)}
                style={{ backgroundColor: 'var(--surface-color)', cursor: 'pointer' }}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Preporučeno)</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Najnoviji, veoma brz)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Najlakši, najbrži)</option>
              </select>
              <p className="help-text">
                Ukoliko primijetite greške o preopterećenju ("high demand"), prebacite se na drugi model. Aplikacija će automatski pokušati rezervni model.
              </p>
            </div>

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={saveApiKey}
              disabled={!tempApiKey.trim()}
            >
              Sačuvaj ključ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
