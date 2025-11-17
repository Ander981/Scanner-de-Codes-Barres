import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Package, ExternalLink, X, AlertCircle, Database, Search } from 'lucide-react';

function UniversalBarcodeScanner() {
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [productInfo, setProductInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSource, setCurrentSource] = useState('');
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // APIs (garder les mêmes fonctions que précédemment)
  const fetchOpenFoodFacts = async (barcode) => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        return {
          name: product.product_name || 'Produit inconnu',
          brand: product.brands || 'Marque inconnue',
          image: product.image_url,
          description: product.generic_name || product.ingredients_text || 'Description non disponible',
          category: product.categories || 'Non spécifié',
          barcode: barcode,
          source: 'Open Food Facts',
          url: product.url || `https://world.openfoodfacts.org/product/${barcode}`
        };
      }
    } catch (error) {
      console.error('Erreur Open Food Facts:', error);
    }
    return null;
  };

  const fetchBarcodeLookup = async (barcode) => {
    const API_KEY = 'dz8v5catin5nrym8s4a0gqktl6otb6';
    try {
      const response = await fetch(`https://api.barcodelookup.com/v3/products?barcode=${barcode}&formatted=y&key=${API_KEY}`);
      const data = await response.json();
      
      if (data.products && data.products.length > 0) {
        const product = data.products[0];
        return {
          name: product.product_name || product.title,
          brand: product.brand || 'Marque inconnue',
          image: product.images[0],
          description: product.description,
          category: product.category,
          barcode: barcode,
          source: 'Barcode Lookup',
          url: product.product_url || `https://www.barcodelookup.com/${barcode}`
        };
      }
    } catch (error) {
      console.error('Erreur Barcode Lookup:', error);
    }
    return null;
  };

  const fetchUPCitemdb = async (barcode) => {
    try {
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
      const data = await response.json();
      
      if (data.code === 'OK' && data.items.length > 0) {
        const item = data.items[0];
        return {
          name: item.title,
          brand: item.brand,
          image: item.images[0],
          description: item.description,
          category: item.category,
          barcode: barcode,
          source: 'UPCitemdb',
          url: item.elid || `https://www.upcitemdb.com/upc/${barcode}`
        };
      }
    } catch (error) {
      console.error('Erreur UPCitemdb:', error);
    }
    return null;
  };

  const fetchGenericSearch = async (barcode) => {
    try {
      const response = await fetch(`https://api.duckduckgo.com/?q=${barcode}&format=json`);
      const data = await response.json();
      
      if (data.Heading || data.Abstract) {
        return {
          name: data.Heading || `Produit ${barcode}`,
          brand: data.AbstractSource || 'Information générique',
          image: data.Image || '',
          description: data.Abstract || 'Informations disponibles via recherche web',
          category: data.AbstractText ? 'Produit grand public' : 'Non spécifié',
          barcode: barcode,
          source: 'Recherche Web',
          url: data.AbstractURL || `https://google.com/search?q=${barcode}`
        };
      }
    } catch (error) {
      console.error('Erreur recherche générique:', error);
    }
    return null;
  };

  const APIs = [
    { name: 'Barcode Lookup', fetch: fetchBarcodeLookup, premium: true },
    { name: 'UPCitemdb', fetch: fetchUPCitemdb, premium: false },
    { name: 'Open Food Facts', fetch: fetchOpenFoodFacts, premium: false },
    { name: 'Recherche Web', fetch: fetchGenericSearch, premium: false }
  ];

  const handleCameraError = useCallback((err) => {
    setCameraError('Impossible d\'accéder à la caméra. Vérifiez les permissions du navigateur.');
    setScanning(false);
    
    if (err.name === 'NotAllowedError') {
      setCameraError('Permission caméra refusée. Autorisez l\'accès dans les paramètres de votre navigateur.');
    } else if (err.name === 'NotFoundError') {
      setCameraError('Aucune caméra trouvée. Vérifiez votre appareil.');
    } else {
      setCameraError(`Erreur caméra: ${err.message}`);
    }
  }, []);

  const handleBarcodeDetected = useCallback(async (code, force = false) => {
    if (!force && code === barcode) return;
    
    setBarcode(code);
    setScanning(false);
    
    setLoading(true);
    setError('');
    setProductInfo(null);
    setCurrentSource('');

    console.log(`🔍 Recherche du code: ${code}`);

    for (const api of APIs) {
      console.log(`Tentative avec ${api.name}...`);
      setCurrentSource(api.name);
      
      try {
        const product = await api.fetch(code);
        if (product) {
          console.log(`✅ Produit trouvé via ${api.name}`);
          setProductInfo(product);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error(`Erreur avec ${api.name}:`, err);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setProductInfo({
      name: `Produit ${code}`,
      brand: 'Marque inconnue',
      image: '',
      description: 'Ce produit existe mais n\'est pas répertorié dans nos bases de données.',
      category: 'Produit non classifié',
      barcode: code,
      source: 'Système',
      url: `https://www.google.com/search?q=${code}`
    });
    
    setLoading(false);
    setCurrentSource('');
  }, [barcode]);

  const detectWithNativeBarcodeDetector = useCallback(async () => {
    try {
      const barcodeDetector = new window.BarcodeDetector({ 
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] 
      });
      
      const detectFrame = async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && scanning) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              handleBarcodeDetected(code);
              return;
            }
          } catch (err) {
            console.error('Erreur détection native:', err);
          }
          
          if (scanning) {
            requestAnimationFrame(detectFrame);
          }
        }
      };
      
      detectFrame();
    } catch (err) {
      console.error('BarcodeDetector failed:', err);
      startCanvasBarcodeDetection();
    }
  }, [scanning, handleBarcodeDetected]);

  const startCanvasBarcodeDetection = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    
    scanIntervalRef.current = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && scanning) {
        console.log('Camera active - Pour une détection avancée, intégrez JsQR ou QuaggaJS');
      }
    }, 2000);
  }, [scanning]);

  const startBarcodeDetection = useCallback(() => {
    if ('BarcodeDetector' in window) {
      detectWithNativeBarcodeDetector();
    } else {
      startCanvasBarcodeDetection();
    }
  }, [detectWithNativeBarcodeDetector, startCanvasBarcodeDetection]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      setError('');
      
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      let stream;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.log('Caméra environnement échouée, essai user...');
        constraints.video.facingMode = 'user';
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(console.error);
          startBarcodeDetection();
        };
      }
    } catch (err) {
      console.error('Erreur caméra complète:', err);
      handleCameraError(err);
    }
  }, [handleCameraError, startBarcodeDetection]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (scanning) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [scanning, startCamera, stopCamera]);

  const searchProduct = async (barcode) => {
    setLoading(true);
    setError('');
    setProductInfo(null);
    setCurrentSource('');

    console.log(`🔍 Recherche du code: ${barcode}`);

    for (const api of APIs) {
      console.log(`Tentative avec ${api.name}...`);
      setCurrentSource(api.name);
      
      try {
        const product = await api.fetch(barcode);
        if (product) {
          console.log(`✅ Produit trouvé via ${api.name}`);
          setProductInfo(product);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error(`Erreur avec ${api.name}:`, err);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setProductInfo({
      name: `Produit ${barcode}`,
      brand: 'Marque inconnue',
      image: '',
      description: 'Ce produit existe mais n\'est pas répertorié dans nos bases de données.',
      category: 'Produit non classifié',
      barcode: barcode,
      source: 'Système',
      url: `https://www.google.com/search?q=${barcode}`
    });
    
    setLoading(false);
    setCurrentSource('');
  };

  const handleManualSearch = () => {
    const code = barcode.trim();
    if (code) {
      searchProduct(code);
    } else {
      setError('Veuillez entrer un code-barres');
    }
  };

  const reset = () => {
    setBarcode('');
    setProductInfo(null);
    setError('');
    setCameraError('');
    setScanning(false);
  };

  const openDetails = (url) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Package className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">Scanner Universel</h1>
          </div>

          {cameraError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-yellow-800 font-semibold">Attention Caméra</p>
                  <p className="text-yellow-700 text-sm">{cameraError}</p>
                  <p className="text-yellow-600 text-xs mt-1">
                    Utilisez la saisie manuelle pour rechercher vos produits.
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading && currentSource && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-blue-800 font-semibold">Recherche en cours...</p>
                <p className="text-blue-600 text-sm">Interrogation de {currentSource}</p>
              </div>
            </div>
          )}

          {!scanning && !productInfo && !loading && (
            <div className="space-y-4">
              <button
                onClick={() => setScanning(true)}
                disabled={!!cameraError}
                className="w-full bg-indigo-600 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Camera className="w-6 h-6" />
                {cameraError ? 'Caméra non disponible' : 'Scanner un code-barres'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">ou</span>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                  placeholder="Entrez le code-barres (EAN-13, UPC, ISBN...)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={handleManualSearch}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-200 transition"
                >
                  <Search className="w-5 h-5" />
                  Rechercher le produit
                </button>
              </div>
            </div>
          )}

          {scanning && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 border-4 border-indigo-500 rounded-xl pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-2 border-red-500 rounded-lg"></div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setScanning(false)}
                  className="flex-1 bg-red-500 text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-600 transition"
                >
                  <X className="w-5 h-5" />
                  Annuler
                </button>
              </div>
              
              <p className="text-center text-sm text-gray-600">
                Positionnez le code-barres dans le cadre rouge
              </p>
              
              {!('BarcodeDetector' in window) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-800 text-sm text-center">
                    ⚠️ Votre navigateur ne supporte pas la détection automatique. 
                    La caméra est active mais la détection est limitée.
                  </p>
                </div>
              )}
            </div>
          )}

          {loading && !currentSource && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Initialisation de la recherche...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-semibold">Erreur</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {productInfo && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold text-gray-800">{productInfo.name}</h2>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      {productInfo.source}
                    </span>
                  </div>
                  <p className="text-gray-600 mb-1">
                    <strong>Marque:</strong> {productInfo.brand}
                  </p>
                  <p className="text-sm text-gray-500">
                    <strong>Code:</strong> {productInfo.barcode}
                  </p>
                </div>
                {productInfo.image && (
                  <img
                    src={productInfo.image}
                    alt={productInfo.name}
                    className="w-24 h-24 object-cover rounded-lg ml-4 border"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
              </div>

              {productInfo.description && productInfo.description !== 'Description non disponible' && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Description:</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {productInfo.description}
                  </p>
                </div>
              )}

              {productInfo.category && productInfo.category !== 'Non spécifié' && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">Catégorie:</h3>
                  <p className="text-gray-700 text-sm">{productInfo.category}</p>
                </div>
              )}

              <div className="flex gap-3">
                {productInfo.url && (
                  <button
                    onClick={() => openDetails(productInfo.url)}
                    className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Voir les détails
                  </button>
                )}
                
                <button
                  onClick={reset}
                  className="bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-300 transition"
                >
                  <Camera className="w-5 h-5" />
                  Nouveau scan
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => openDetails(`https://www.google.com/search?q=${productInfo.barcode}`)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm underline"
                >
                  Rechercher ce produit sur Google
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 text-center text-sm text-gray-600">
          <p>📷 Compatible tous navigateurs | 🛍️ Tous types de produits | 🔍 Multiples sources de données</p>
        </div>
              <p className="text-center text-gray-500 text-sm">
          Développé par Anderson MICHEL
        </p>

      </div>
    </div>
  );
}

export default UniversalBarcodeScanner;