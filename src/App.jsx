import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Mic, MicOff, LayoutDashboard, ShoppingCart, 
  Package, History, TrendingUp, AlertCircle, 
  Bot, Send, Plus, X, CheckCircle2, Edit2, Trash2,
  CreditCard, Share2, FileText, Receipt,
  Settings, Download, Upload, Store, Search, Camera, Barcode, 
  Calendar, FileSpreadsheet, HelpCircle, ChevronDown, ChevronUp, Image as ImageIcon,
  Mail, ShieldCheck
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, YAxis
} from 'recharts';

const INITIAL_INVENTORY = [
  { id: 1, name: 'Indomie Goreng', stock: 45, price: 3500, cost: 3000, category: 'Sembako', barcode: '089686043115' },
  { id: 2, name: 'Kopi Susu', stock: 20, price: 5000, cost: 3500, category: 'Minuman', barcode: '' },
  { id: 3, name: 'Roti Bakar', stock: 15, price: 12000, cost: 8000, category: 'Makanan Ringan', barcode: '' },
  { id: 4, name: 'Gula Pasir 1kg', stock: 5, price: 16000, cost: 14500, category: 'Sembako', barcode: '' },
  { id: 5, name: 'Telur Ayam 1kg', stock: 8, price: 28000, cost: 25000, category: 'Sembako', barcode: '' },
];

const QNA_LIST = [
  { q: "Bagaimana cara mencatat transaksi jualan?", a: "Klik ikon Mikrofon besar di tengah bawah. Anda bisa berbicara (misal: 'Jual 2 indomie goreng'), atau ketik pesanan secara manual/paste dari WA." },
  { q: "Apakah AI bisa salah hitung harga?", a: "Tidak. AI hanya mendeteksi NAMA dan JUMLAH barang. Harga total selalu dikalkulasi secara PASTI menggunakan data harga yang ada di menu 'Produk' Anda." },
  { q: "Apa itu fitur Kasbon?", a: "Jika Anda mengucapkan 'Pak Budi kasbon 2 kopi', sistem tidak akan memasukkannya ke Omzet harian, melainkan masuk ke daftar Piutang sampai tagihan tersebut dilunasi." },
  { q: "Bagaimana cara mencatat pengeluaran?", a: "Buka Mikrofon dan ucapkan pengeluaran Anda. Contoh: 'Bayar uang sampah 20 ribu' atau 'Beli plastik 10 ribu'. Laba bersih hari itu akan otomatis terpotong." },
  { q: "Apakah butuh koneksi internet?", a: "Ya. Karena kita menggunakan Google Gemini AI untuk memproses bahasa manusia, Anda memerlukan koneksi internet aktif untuk menggunakan input AI." },
  { q: "Kenapa API Key Gemini harus diisi?", a: "API Key adalah 'kunci' pribadi agar aplikasi ini bisa terhubung ke otak AI Google secara gratis. Tanpanya, fitur AI tidak akan berfungsi." },
  { q: "Bagaimana cara mendapatkan API Key Gemini?", a: "Buka Google AI Studio di browser, login dengan akun Google, pilih Get API key, lalu Create API key. Salin key yang muncul, buka Pengaturan WarungPulse, paste di kolom Gemini AI Key, lalu tekan Simpan." },
];

const getLocalStorage = (key, initialValue) => {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  } catch (error) {
    console.warn("Gagal membaca dari localStorage", error);
    return initialValue;
  }
};

const parseIndoDate = (dateString) => {
  const parts = dateString.split('/');
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  return new Date();
};

const isRunningStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Database States
  const [inventory, setInventory] = useState(() => getLocalStorage('wp_inventory', INITIAL_INVENTORY));
  const [transactions, setTransactions] = useState(() => getLocalStorage('wp_transactions', []));
  const [piutang, setPiutang] = useState(() => getLocalStorage('wp_piutang', []));
  const [aiInsights, setAiInsights] = useState(() => getLocalStorage('wp_insights', ["Selamat datang di WarungPulse AI! Coba gunakan fitur Suara untuk mencatat transaksi pertama Anda."]));
  const [storeProfile, setStoreProfile] = useState(() => getLocalStorage('wp_store_profile', { name: 'WARUNGPULSE AI', phone: '', logo: '' }));
  const [geminiApiKey, setGeminiApiKey] = useState(() => getLocalStorage('wp_gemini_api_key', ''));
  const [categories, setCategories] = useState(() => getLocalStorage('wp_categories', ['Sembako', 'Minuman', 'Makanan Ringan', 'Rokok', 'Lainnya']));
  
  // App UI States
  const [reportFilter, setReportFilter] = useState('hari_ini');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: null, cancelText: 'Batal', actionText: 'Lanjutkan', isDanger: false });
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [activeQnA, setActiveQnA] = useState(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => isRunningStandalone());
  const [showOnboarding, setShowOnboarding] = useState(() => !getLocalStorage('wp_onboarding_done', false));
  const [backupReminderInterval, setBackupReminderInterval] = useState(() => getLocalStorage('wp_backup_reminder_interval', 'weekly'));
  const [lastBackupAt, setLastBackupAt] = useState(() => getLocalStorage('wp_last_backup_at', ''));
  const [backupCheckAt] = useState(() => Date.now());
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  // AI & Voice States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [lastParsedData, setLastParsedData] = useState(null);
  const [tempApiKeyInput, setTempApiKeyInput] = useState(geminiApiKey);

  // Scanner States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  // Product Form States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', stock: '', price: '', cost: '', category: 'Lainnya', barcode: '' });
  const [newCategoryName, setNewCategoryName] = useState('');

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync to LocalStorage
  useEffect(() => { window.localStorage.setItem('wp_inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { window.localStorage.setItem('wp_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { window.localStorage.setItem('wp_piutang', JSON.stringify(piutang)); }, [piutang]);
  useEffect(() => { window.localStorage.setItem('wp_insights', JSON.stringify(aiInsights)); }, [aiInsights]);
  useEffect(() => { window.localStorage.setItem('wp_store_profile', JSON.stringify(storeProfile)); }, [storeProfile]);
  useEffect(() => { window.localStorage.setItem('wp_gemini_api_key', JSON.stringify(geminiApiKey)); }, [geminiApiKey]);
  useEffect(() => { window.localStorage.setItem('wp_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { window.localStorage.setItem('wp_onboarding_done', JSON.stringify(!showOnboarding)); }, [showOnboarding]);
  useEffect(() => { window.localStorage.setItem('wp_backup_reminder_interval', JSON.stringify(backupReminderInterval)); }, [backupReminderInterval]);
  useEffect(() => { window.localStorage.setItem('wp_last_backup_at', JSON.stringify(lastBackupAt)); }, [lastBackupAt]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setIsStandaloneApp(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Voice Recognition Init
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'id-ID';

      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const installApp = async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    const choiceResult = await deferredInstallPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setIsStandaloneApp(true);
    }
    setDeferredInstallPrompt(null);
  };

  const filteredTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions.filter(tx => {
      if (reportFilter === 'semua') return true;
      const txDate = parseIndoDate(tx.date);
      txDate.setHours(0, 0, 0, 0);

      if (reportFilter === 'hari_ini') return txDate.getTime() === today.getTime();
      if (reportFilter === 'minggu_ini') {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        return txDate >= weekAgo && txDate <= today;
      }
      if (reportFilter === 'bulan_ini') return txDate.getMonth() === today.getMonth() && txDate.getFullYear() === today.getFullYear();
      return true;
    });
  }, [transactions, reportFilter]);

  const totalOmzet = filteredTransactions.filter(tx => tx.type !== 'pengeluaran').reduce((acc, curr) => acc + curr.total_transaction, 0);
  const totalProfit = filteredTransactions.reduce((acc, curr) => acc + (curr.total_profit || 0), 0);
  const totalKasbon = piutang.reduce((acc, curr) => acc + curr.total_transaction, 0);
  const backupReminderDays = backupReminderInterval === 'monthly' ? 30 : 7;
  const isBackupReminderOn = backupReminderInterval !== 'off';
  const lastBackupTime = lastBackupAt ? new Date(lastBackupAt).getTime() : 0;
  const isBackupDue = isBackupReminderOn && (!lastBackupAt || backupCheckAt - lastBackupTime >= backupReminderDays * 24 * 60 * 60 * 1000);
  const lastBackupLabel = lastBackupAt ? new Date(lastBackupAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Belum pernah backup';

  const openProductModal = useCallback((product = null, scannedBarcode = '') => {
    if (product) {
      setEditingProduct(product);
      setProductForm({ name: product.name, stock: product.stock, price: product.price, cost: product.cost || '', category: product.category || 'Lainnya', barcode: product.barcode || '' });
    } else {
      setEditingProduct(null);
      setProductForm({ name: '', stock: '', price: '', cost: '', category: 'Lainnya', barcode: scannedBarcode });
    }
    setIsProductModalOpen(true);
  }, []);

  const handleScannedBarcode = useCallback((scannedCode) => {
    const code = scannedCode.trim();
    if (!code) return;

    const item = inventory.find(i => i.barcode === code);
    
    if (item) {
      if (item.stock < 1) {
        setConfirmDialog({
          isOpen: true,
          title: 'Stok Tidak Cukup',
          message: `${item.name} stoknya kosong. Restock dulu sebelum mencatat penjualan.`,
          cancelText: 'Tutup',
          actionText: 'Restock',
          action: () => { setConfirmDialog({isOpen: false}); openProductModal(item); setActiveTab('inventory'); }
        });
        return;
      }

      setConfirmDialog({
        isOpen: true, title: 'Barang Ditemukan', message: `Tambahkan penjualan 1x ${item.name} (Rp ${item.price.toLocaleString('id-ID')}) ke Omzet?`,
        cancelText: 'Batal', actionText: 'Jual Sekarang',
        action: () => {
          const newTx = {
            id: Date.now(), time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), date: new Date().toLocaleDateString('id-ID'),
            type: 'tunai', customer_name: 'Walk-in', notes: 'Via Barcode Scanner',
            items: [{ name: item.name, qty: 1, price: item.price, cost: item.cost, subtotal: item.price, profit: item.price - item.cost }],
            total_transaction: item.price, total_profit: item.price - item.cost
          };
          setTransactions(prev => [newTx, ...prev]);
          setInventory(prevInv => prevInv.map(inv => inv.id === item.id ? { ...inv, stock: Math.max(0, inv.stock - 1) } : inv));
          setAiInsights(prev => [`Transaksi cepat ${item.name} berhasil dicatat via Barcode!`, ...prev]);
          setConfirmDialog({isOpen: false});
        }
      });
    } else {
      setConfirmDialog({
        isOpen: true, title: 'Barcode Baru', message: `Barcode [${code}] belum terdaftar. Ingin mendaftarkan produk ini sekarang?`,
        cancelText: 'Batal', actionText: 'Tambah Produk',
        action: () => { setConfirmDialog({isOpen: false}); openProductModal(null, code); setActiveTab('inventory'); }
      });
    }
  }, [inventory, openProductModal]);

  useEffect(() => {
    let html5QrcodeScanner = null;
    let isDisposed = false;
    let initTimer = null;

    if (isScannerOpen) {
      initTimer = setTimeout(async () => {
        try {
          const { Html5QrcodeScanner } = await import('html5-qrcode');
          if (isDisposed) return;

          html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
          html5QrcodeScanner.render(
            (decodedText) => {
              html5QrcodeScanner.clear();
              setIsScannerOpen(false);
              handleScannedBarcode(decodedText);
            },
            () => {}
          );
        } catch(error) { console.warn("Scanner Init Error", error); }
      }, 300);
    }

    return () => {
      isDisposed = true;
      if (initTimer) clearTimeout(initTimer);
      if (html5QrcodeScanner) html5QrcodeScanner.clear().catch(() => {});
    };
  }, [isScannerOpen, handleScannedBarcode]);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStoreProfile({ ...storeProfile, logo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const processTransactionWithAI = async (inputText) => {
    if (!inputText.trim()) return;

    if (!isOnline) {
      setConfirmDialog({
        isOpen: true,
        title: 'Sedang Offline',
        message: 'Data lokal tetap bisa dibuka, tetapi proses AI membutuhkan internet. Sambungkan koneksi lalu coba lagi.',
        cancelText: 'Tutup',
        action: () => setConfirmDialog({isOpen:false})
      });
      return;
    }
    
    if (!geminiApiKey) {
      setConfirmDialog({ 
        isOpen: true, title: 'API Key Diperlukan', 
        message: 'Mohon masukkan API Key Gemini Anda di menu Pengaturan (Roda Gigi) untuk mengaktifkan Kecerdasan Buatan.', 
        cancelText: 'Tutup', actionText: 'Ke Pengaturan',
        action: () => { setConfirmDialog({isOpen: false}); setActiveTab('settings'); setIsModalOpen(false); } 
      });
      return;
    }

    setIsProcessingAI(true);
    setLastParsedData(null);
    setIsListening(false);
    recognitionRef.current?.stop();

    try {
      const inventoryContext = inventory.map(item => `${item.name} (Jual: ${item.price}, Modal: ${item.cost})`).join(', ');

      const systemPrompt = `Kamu adalah 'WarungPulse AI', asisten cerdas untuk UMKM. Tugasmu mengekstrak data dari ucapan/chat pemilik. Ada EMPAT aktivitas:
      1. TRANSAKSI JUAL TUNAI (type: "tunai"). Pelanggan beli langsung.
      2. KASBON / UTANG (type: "kasbon"). Pelanggan berutang. WAJIB isi customer_name.
      3. TAMBAH STOK / KULAKAN (type: "tambah_stok"). Pemilik menambah stok barang ke warung.
      4. PENGELUARAN BIAYA (type: "pengeluaran"). Biaya operasional warung (listrik, sampah, bensin, beli perlengkapan non-jual).

      Referensi Katalog: [${inventoryContext}]. Jika barang baru di aktivitas tambah_stok, gunakan harga/modal yang diucap.
      
      Output WAJIB berupa JSON murni tanpa awalan/akhiran (tanpa \`\`\`json):
      {
        "type": "tunai" | "kasbon" | "tambah_stok" | "pengeluaran",
        "customer_name": "Nama jika kasbon/pesanan",
        "notes": "Catatan pengiriman/pesan khusus (jika ada)",
        "items": [{ "name": "Nama", "qty": 1, "price": 0, "cost": 0, "subtotal": 0 }],
        "total_transaction": 0,
        "business_insight": "1 kalimat saran singkat atau insight cerdas dari transaksi ini"
      }`;

      const payload = {
        contents: [{ parts: [{ text: `Input Pemilik: "${inputText}"` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json" }
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("API Error");

      const result = await response.json();
      if (result.candidates && result.candidates[0].content.parts[0].text) {
        const parsedData = JSON.parse(result.candidates[0].content.parts[0].text);
        
        // KALIBRASI HARGA AGAR 100% AKURAT
        const calibratedItems = parsedData.items.map(aiItem => {
          const localItem = inventory.find(inv => inv.name.toLowerCase().includes(aiItem.name.toLowerCase()) || aiItem.name.toLowerCase().includes(inv.name.toLowerCase()));
          
          if (parsedData.type === 'tambah_stok') {
             return { ...aiItem, name: localItem ? localItem.name : aiItem.name, price: aiItem.price || (localItem?.price || 0), cost: aiItem.cost || (localItem?.cost || 0), subtotal: (aiItem.cost || aiItem.price || 0) * aiItem.qty, profit: 0 };
          } else if (parsedData.type === 'pengeluaran') {
             const biaya = aiItem.subtotal || aiItem.price || 0;
             return { ...aiItem, name: aiItem.name, qty: aiItem.qty || 1, price: biaya, cost: biaya, subtotal: biaya, profit: -biaya }; 
          } else {
            if (localItem) {
              const itemCost = localItem.cost || localItem.price; 
              return { ...aiItem, name: localItem.name, price: localItem.price, cost: itemCost, subtotal: localItem.price * aiItem.qty, profit: (localItem.price - itemCost) * aiItem.qty };
            }
            return { ...aiItem, cost: aiItem.cost || aiItem.price || 0, subtotal: (aiItem.price || 0) * (aiItem.qty || 1), profit: 0 };
          }
        });

        const calibratedData = {
          ...parsedData,
          items: calibratedItems,
          total_transaction: calibratedItems.reduce((sum, item) => sum + item.subtotal, 0),
          total_profit: calibratedItems.reduce((sum, item) => sum + item.profit, 0),
        };

        setTimeout(() => {
          const isApplied = applyTransaction(calibratedData);
          if (isApplied) setLastParsedData(calibratedData);
          setIsProcessingAI(false);
          setTranscript('');
        }, 800);
      }
    } catch (error) {
      console.error("AI Error:", error);
      setIsProcessingAI(false);
      setConfirmDialog({ isOpen: true, title: 'Koneksi Gagal', message: 'Pastikan API Key benar dan internet lancar.', cancelText: 'Tutup', action: () => setConfirmDialog({isOpen:false}) });
    }
  };

  const applyTransaction = (data) => {
    if (data.type === 'tambah_stok') {
      setInventory(prevInv => {
        let newInv = [...prevInv];
        data.items.forEach(newItem => {
          const idx = newInv.findIndex(inv => inv.name.toLowerCase().includes(newItem.name.toLowerCase()) || newItem.name.toLowerCase().includes(inv.name.toLowerCase()));
          if (idx >= 0) {
            newInv[idx] = { ...newInv[idx], stock: newInv[idx].stock + newItem.qty, price: newItem.price > 0 ? newItem.price : newInv[idx].price, cost: newItem.cost > 0 ? newItem.cost : newInv[idx].cost };
          } else {
            newInv.push({ id: Date.now() + Math.random(), name: newItem.name, stock: newItem.qty, price: newItem.price || 0, cost: newItem.cost || newItem.price || 0, category: 'Lainnya', barcode: '' });
          }
        });
        return newInv;
      });
      if (data.business_insight) setAiInsights(prev => [data.business_insight, ...prev]);
      return true; 
    }

    if (data.type !== 'pengeluaran') {
      const insufficientItems = data.items
        .map(soldItem => {
          const stockItem = inventory.find(inv => inv.name.toLowerCase().includes(soldItem.name.toLowerCase()) || soldItem.name.toLowerCase().includes(inv.name.toLowerCase()));
          if (!stockItem || stockItem.stock >= soldItem.qty) return null;
          return `${stockItem.name}: stok ${stockItem.stock}, diminta ${soldItem.qty}`;
        })
        .filter(Boolean);

      if (insufficientItems.length > 0) {
        setConfirmDialog({
          isOpen: true,
          title: 'Stok Tidak Cukup',
          message: `Transaksi belum dicatat. ${insufficientItems.join('; ')}.`,
          cancelText: 'Tutup',
          actionText: 'Cek Produk',
          action: () => { setConfirmDialog({isOpen: false}); setActiveTab('inventory'); setIsModalOpen(false); }
        });
        return false;
      }
    }

    const newTx = {
      id: Date.now(), time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), date: new Date().toLocaleDateString('id-ID'),
      type: data.type || 'tunai', customer_name: data.customer_name || 'Pelanggan Walk-in', notes: data.notes || '',
      items: data.items, total_transaction: data.total_transaction, total_profit: data.total_profit || 0
    };

    if (newTx.type === 'kasbon') setPiutang(prev => [newTx, ...prev]);
    else setTransactions(prev => [newTx, ...prev]);

    if (data.type !== 'pengeluaran') {
      setInventory(prevInv => {
        let newInv = [...prevInv];
        data.items.forEach(soldItem => {
          const idx = newInv.findIndex(inv => inv.name.toLowerCase().includes(soldItem.name.toLowerCase()) || soldItem.name.toLowerCase().includes(inv.name.toLowerCase()));
          if (idx >= 0) newInv[idx] = { ...newInv[idx], stock: Math.max(0, newInv[idx].stock - soldItem.qty) };
        });
        return newInv;
      });
    }

    if (data.business_insight) setAiInsights(prev => [data.business_insight, ...prev]);
    return true;
  };

  const exportToCSV = () => {
    const salesItems = filteredTransactions
      .filter(tx => tx.type !== 'pengeluaran')
      .flatMap(tx => tx.items.map(item => ({
        ...item,
        hpp: (item.cost || 0) * (item.qty || 0),
        profit: item.profit || ((item.price || 0) - (item.cost || 0)) * (item.qty || 0),
      })));

    const totalPayment = salesItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const totalHpp = salesItems.reduce((sum, item) => sum + item.hpp, 0);
    const totalProfitReport = salesItems.reduce((sum, item) => sum + item.profit, 0);
    const periodLabel = reportFilter.replace('_', ' ').toUpperCase();
    const formatRp = (value) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

    const rows = salesItems.map((item, index) => `
      <tr>
        <td>T${String(index + 1).padStart(3, '0')}</td>
        <td class="text-left">${escapeHtml(item.name)}</td>
        <td>${item.qty || 0}</td>
        <td>Pcs</td>
        <td>${formatRp(item.price)}</td>
        <td>${formatRp(item.subtotal)}</td>
        <td>${formatRp(item.hpp)}</td>
        <td>${formatRp(item.profit)}</td>
      </tr>
    `).join('');

    const emptyRow = `
      <tr>
        <td colspan="8" class="empty">Belum ada penjualan pada periode ini.</td>
      </tr>
    `;

    const excelHtml = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #4b5563; padding: 6px 8px; font-size: 12px; text-align: center; }
            .title { font-size: 16px; font-weight: 700; text-align: center; border: none; padding: 4px; }
            .subtitle { font-size: 13px; text-align: center; border: none; padding: 2px 4px 12px; }
            .period { text-align: left; border: none; font-size: 12px; padding: 8px 4px; }
            .head { background: #0b63ce; color: #ffffff; font-weight: 700; }
            .total { background: #0b63ce; color: #ffffff; font-weight: 700; }
            .text-left { text-align: left; }
            .empty { color: #6b7280; font-style: italic; padding: 14px; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="8" class="title">LAPORAN HASIL PENJUALAN TOKO SEMBAKO</td></tr>
            <tr><td colspan="8" class="subtitle">${escapeHtml(storeProfile.name)}</td></tr>
            <tr><td colspan="8" class="period">Periode: ${escapeHtml(periodLabel)}</td></tr>
            <tr class="head">
              <th>Kode</th>
              <th>Nama Barang</th>
              <th>Jumlah</th>
              <th>Satuan</th>
              <th>Harga Barang</th>
              <th>Total Pembayaran</th>
              <th>HPP</th>
              <th>Keuntungan</th>
            </tr>
            ${rows || emptyRow}
            <tr class="total">
              <td colspan="5">TOTAL</td>
              <td>${formatRp(totalPayment)}</td>
              <td>${formatRp(totalHpp)}</td>
              <td>${formatRp(totalProfitReport)}</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_WarungPulse_${reportFilter}_${new Date().toLocaleDateString('id-ID')}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportBackupData = () => {
    const backup = {
      inventory,
      transactions,
      piutang,
      aiInsights,
      storeProfile,
      categories,
      backupReminderInterval,
      backupDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WarungPulse_Backup_${new Date().toLocaleDateString('id-ID')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLastBackupAt(new Date().toISOString());
  };

  const shareToWhatsApp = (receipt) => {
    const itemsText = receipt.items.map(i => `${i.qty}x ${i.name} = Rp ${i.subtotal.toLocaleString('id-ID')}`).join('%0A');
    const statusText = receipt.type === 'kasbon' ? `*STATUS: KASBON* (Belum Lunas)%0APelanggan: ${receipt.customer_name}` : (receipt.type === 'pengeluaran' ? `*BIAYA PENGELUARAN*` : `*STATUS: LUNAS*`);
    const notesText = receipt.notes ? `%0A*Catatan:* ${receipt.notes}` : '';
    const waText = `*STRUK ${storeProfile.name.toUpperCase()}*%0A${storeProfile.phone ? `WA: ${storeProfile.phone}%0A` : ''}---------------------------%0ATgl: ${receipt.date} ${receipt.time}%0A${statusText}${notesText}%0A---------------------------%0A${itemsText}%0A---------------------------%0A*TOTAL: Rp ${receipt.total_transaction.toLocaleString('id-ID')}*%0A---------------------------%0ATerima kasih.`;
    window.open(`https://wa.me/?text=${waText}`, '_blank');
  };

  const saveProduct = (e) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price) return;
    const newProductData = {
      name: productForm.name, stock: parseInt(productForm.stock) || 0, price: parseInt(productForm.price) || 0,
      cost: parseInt(productForm.cost) || 0, category: productForm.category, barcode: productForm.barcode
    };
    if (editingProduct) setInventory(prev => prev.map(item => item.id === editingProduct.id ? { ...item, ...newProductData } : item));
    else setInventory(prev => [{ id: Date.now(), ...newProductData }, ...prev]);
    setIsProductModalOpen(false);
  };

  const executeTutupBuku = () => {
    setTransactions([]);
    setAiInsights(prev => ["Buku catatan telah direstart. Omzet dan riwayat telah direset, namun Stok dan Piutang Anda tetap aman.", ...prev]);
    setConfirmDialog({ isOpen: false });
  };

  const handleAddCategory = () => {
    if(!newCategoryName.trim()) return;
    const catName = newCategoryName.trim();
    if(!categories.includes(catName)) {
      setCategories(prev => [...prev, catName]);
      setNewCategoryName('');
    } else {
      setConfirmDialog({ isOpen: true, title: 'Kategori Sudah Ada', message: 'Nama kategori tersebut sudah terdaftar.', cancelText: 'Tutup', action: null });
    }
  };

  const handleDeleteCategory = (catToDelete) => {
    setConfirmDialog({
      isOpen: true, 
      title: 'Hapus Kategori?', 
      message: `Kategori "${catToDelete}" akan dihapus. Barang yang menggunakan kategori ini akan otomatis dipindah ke "Lainnya".`, 
      cancelText: 'Batal', 
      actionText: 'Hapus', 
      isDanger: true, 
      action: () => {
        setCategories(prev => prev.filter(c => c !== catToDelete));
        setInventory(prev => prev.map(item => item.category === catToDelete ? { ...item, category: 'Lainnya' } : item));
        if (selectedCategory === catToDelete) setSelectedCategory('Semua');
        setConfirmDialog({isOpen: false});
      }
    });
  };

  const renderDashboardView = () => {
    const chartData = [...filteredTransactions].reverse().slice(-7).map((tx, index) => ({ name: `Tx ${index + 1}`, omzet: tx.type !== 'pengeluaran' ? tx.total_transaction : 0 }));
    const lowStockItems = inventory.filter(item => item.stock < 10);
    const lowStockPreview = lowStockItems.slice(0, 3);
    const latestInsight = aiInsights[0];

    return (
      <div className="space-y-4 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Halo, {storeProfile.name}!</h2>
          <p className="text-sm text-gray-500">Ringkasan bisnis Anda {reportFilter === 'hari_ini' ? 'hari ini' : 'saat ini'}.</p>
        </div>

        {showOnboarding && (
          <div className="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Mulai pakai WarungPulse</h3>
                <p className="text-xs text-gray-500 mt-0.5">Cukup siapkan ini dulu agar catatan warung rapi.</p>
              </div>
              <button onClick={() => setShowOnboarding(false)} className="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1" title="Tutup panduan"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-gray-700">
              <div className="flex items-center gap-2"><Package size={14} className="text-orange-500 shrink-0" /><span>Tambah produk dan harga jual.</span></div>
              <div className="flex items-center gap-2"><Settings size={14} className="text-orange-500 shrink-0" /><span>Isi API Key Gemini di Pengaturan.</span></div>
              <div className="flex items-center gap-2"><Mic size={14} className="text-orange-500 shrink-0" /><span>Tekan mikrofon untuk catat transaksi.</span></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setActiveTab('settings'); setShowOnboarding(false); }} className="flex-1 bg-orange-500 text-white font-bold py-2.5 rounded-xl text-xs">Atur Sekarang</button>
              <button onClick={() => setShowOnboarding(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-xs">Saya Mengerti</button>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-3xl p-5 text-white shadow-lg shadow-orange-300">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-orange-100 text-xs font-bold uppercase tracking-wider mb-1">Total Omzet</p>
              <h3 className="text-3xl font-extrabold leading-none">Rp {totalOmzet.toLocaleString('id-ID')}</h3>
            </div>
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><TrendingUp size={22} className="text-white" /></div>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 border border-white/20 backdrop-blur-md flex justify-between items-center">
            <div>
              <p className="text-orange-100 text-[10px] font-bold uppercase tracking-wider mb-0.5">Laba Bersih </p>
              <p className="text-lg font-bold text-white">Rp {totalProfit.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider shadow-sm">Profit</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="flex items-center space-x-2 text-red-500 mb-1.5">
              <CreditCard size={16} /><span className="text-[9px] font-bold uppercase tracking-wider">Total Kasbon</span>
            </div>
            <p className="text-base font-bold text-gray-900">Rp {totalKasbon.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="flex items-center space-x-2 text-blue-500 mb-1.5">
              <ShoppingCart size={16} /><span className="text-[9px] font-bold uppercase tracking-wider">Transaksi</span>
            </div>
            <p className="text-base font-bold text-gray-900">{filteredTransactions.length} Nota</p>
          </div>
        </div>

        {latestInsight && (
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center"><Bot size={15} className="mr-2 text-orange-500" /> AI Insights</h3>
            <div className="bg-orange-50/80 border border-orange-100 rounded-2xl p-3">
              <div className="space-y-2">
                {aiInsights.slice(0, 1).map((insight, idx) => (
                  <div key={idx} className="flex items-start space-x-2.5">
                    <span className="text-orange-500 text-lg leading-none mt-0.5">-</span>
                    <p className="text-xs text-gray-700 italic font-medium leading-relaxed line-clamp-2">"{insight}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {chartData.length > 0 && (
        <div>
           <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center"><TrendingUp size={15} className="mr-2 text-orange-500" /> Tren Omzet Terakhir</h3>
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOmzet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value) => `Rp${value/1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }} itemStyle={{ color: '#f97316', fontWeight: '900', fontSize: '18px' }} labelStyle={{ display: 'none' }} formatter={(value) => [`Rp ${value.toLocaleString('id-ID')}`, 'Omzet']} />
                  <Area type="monotone" dataKey="omzet" stroke="#f97316" strokeWidth={4} fillOpacity={1} fill="url(#colorOmzet)" activeDot={{ r: 8, strokeWidth: 3, stroke: '#f97316', fill: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
          </div>
        </div>
        )}

        {lowStockItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-800 flex items-center"><AlertCircle size={15} className="mr-2 text-red-500" /> Peringatan Stok</h3>
              {lowStockItems.length > lowStockPreview.length && (
                <button onClick={() => setActiveTab('inventory')} className="text-[10px] font-bold text-orange-600">Lihat semua</button>
              )}
            </div>
            <div className="space-y-2">
              {lowStockPreview.map(item => (
                <div key={item.id} className="bg-red-50 px-3 py-2.5 rounded-xl border border-red-100 flex justify-between items-center gap-3">
                  <span className="text-sm font-bold text-gray-800">{item.name}</span>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-xs text-red-600 font-bold">Sisa {item.stock}</span>
                    <button onClick={() => { setActiveTab('inventory'); openProductModal(item); }} className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-md font-bold uppercase hover:bg-red-200">Restock</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTransactionView = () => {
    const getProductSummary = () => {
      const summary = {};
      filteredTransactions.filter(tx => tx.type !== 'pengeluaran').forEach(tx => {
        tx.items.forEach(item => {
          if (summary[item.name]) { summary[item.name].qty += item.qty; summary[item.name].revenue += item.subtotal; }
          else summary[item.name] = { qty: item.qty, revenue: item.subtotal };
        });
      });
      return Object.entries(summary).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.qty - a.qty);
    };
    const productSummary = getProductSummary();

    const shareLaporanWA = () => {
      const itemsText = productSummary.map(i => `- ${i.qty}x ${i.name} (Rp ${i.revenue.toLocaleString('id-ID')})`).join('%0A');
      const waText = `*LAPORAN PENJUALAN*%0A${storeProfile.name.toUpperCase()}%0AFilter: ${reportFilter.replace('_', ' ').toUpperCase()}%0A---------------------------%0A*Total Omzet: Rp ${totalOmzet.toLocaleString('id-ID')}*%0A*Laba Bersih: Rp ${totalProfit.toLocaleString('id-ID')}*%0A*Total Kasbon: Rp ${totalKasbon.toLocaleString('id-ID')}*%0A---------------------------%0A*BARANG LAKU:*%0A${itemsText ? itemsText : '- Belum ada penjualan'}%0A---------------------------%0A_Dicetak dari WarungPulse AI_`;
      window.open(`https://wa.me/?text=${waText}`, '_blank');
    };

    return (
      <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-gray-800">Laporan Keuangan</h2>
          <div className="flex space-x-2">
            <button onClick={exportToCSV} className="bg-blue-100 text-blue-700 p-2 rounded-xl text-xs font-bold flex items-center hover:bg-blue-200 shadow-sm" title="Ekspor ke Excel"><FileSpreadsheet size={16} /></button>
            <button onClick={shareLaporanWA} className="bg-green-100 text-green-700 p-2 rounded-xl text-xs font-bold flex items-center hover:bg-green-200 shadow-sm" title="Share ke WA"><Share2 size={16} /></button>
          </div>
        </div>

        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center">
          <Calendar size={16} className="text-gray-400 mr-2 ml-1" />
          <select value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none w-full">
            <option value="hari_ini">Transaksi Hari Ini</option>
            <option value="minggu_ini">Transaksi Minggu Ini</option>
            <option value="bulan_ini">Transaksi Bulan Ini</option>
            <option value="semua">Semua Waktu</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Omzet</p>
            <p className="text-lg font-extrabold text-gray-900">Rp {totalOmzet.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-2xl shadow-sm border border-green-100">
            <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider mb-1">Laba Bersih</p>
            <p className="text-lg font-extrabold text-green-700">Rp {totalProfit.toLocaleString('id-ID')}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center"><TrendingUp size={16} className="mr-2 text-orange-500" /> Barang Laku (Best Seller)</h3>
          {productSummary.length === 0 ? ( <p className="text-xs text-gray-400 italic">Belum ada barang terjual.</p> ) : (
            <div className="flex overflow-x-auto pb-2 custom-scrollbar space-x-3">
              {productSummary.map((item, idx) => (
                <div key={idx} className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-100 shrink-0 min-w-[140px] flex flex-col justify-between">
                  <p className="text-xs font-bold text-gray-800 mb-2 truncate">{item.name}</p>
                  <div className="flex justify-between items-end mt-auto">
                    <span className="text-[10px] text-gray-500 font-medium">Laku</span>
                    <span className="text-lg font-bold text-orange-500 leading-none">{item.qty}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-3 border-t border-gray-200 pt-5">Rincian Transaksi (Nota)</h3>
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm bg-gray-50 rounded-2xl border border-dashed border-gray-200">Belum ada transaksi di periode ini</div>
            ) : (
              filteredTransactions.map(tx => (
                <div key={tx.id} onClick={() => setSelectedReceipt(tx)} className={`bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center cursor-pointer transition-colors ${tx.type === 'pengeluaran' ? 'border-red-100 hover:border-red-200' : 'border-gray-100 hover:border-orange-200'}`}>
                  <div>
                    <div className="flex items-center space-x-2 mb-1.5">
                      <p className="text-xs text-gray-400">{tx.date} - {tx.time}</p>
                      {tx.type === 'pengeluaran' && <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold">Biaya Keluar</span>}
                    </div>
                    <div className="space-y-1">
                      {tx.items.map((item, i) => <p key={i} className="text-sm text-gray-800 font-medium">{tx.type !== 'pengeluaran' ? `${item.qty}x ` : ''}{item.name}</p>)}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className={`${tx.type === 'pengeluaran' ? 'text-red-600' : 'text-orange-600'} font-bold text-base`}>Rp {tx.total_transaction.toLocaleString('id-ID')}</p>
                    {tx.type !== 'pengeluaran' && <p className="text-[10px] text-green-600 font-medium mt-0.5 mb-1.5">+ Untung Rp {(tx.total_profit || 0).toLocaleString('id-ID')}</p>}
                    <div className="text-[10px] font-bold text-gray-500 flex items-center bg-gray-100 px-2.5 py-1.5 rounded-lg mt-1"><Receipt size={12} className="mr-1" /> Struk</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCategoryManager = () => (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="font-bold text-sm text-gray-700 mb-3 flex items-center"><Package size={18} className="mr-2 text-purple-500"/> Manajemen Kategori</h3>
      <div className="flex space-x-2 mb-3">
        <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nama kategori baru..." className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
        <button onClick={handleAddCategory} className="bg-purple-500 text-white font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-purple-600 transition-colors text-sm">Tambah</button>
      </div>
      <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
        {categories.map(cat => (
          <div key={cat} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-sm font-medium text-gray-700">{cat}</span>
            {cat !== 'Lainnya' && (
              <button onClick={() => handleDeleteCategory(cat)} className="text-red-500 p-1.5 hover:bg-red-100 rounded-lg transition-colors" title="Hapus Kategori"><Trash2 size={14}/></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderInventoryView = () => {
    const filteredInv = inventory.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategory === 'Semua' || item.category === selectedCategory;
      return matchSearch && matchCategory;
    });

    return (
      <div className="space-y-4 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-gray-800">Katalog Produk</h2>
          <button onClick={() => openProductModal()} className="bg-orange-100 text-orange-600 px-3 py-2 rounded-xl text-sm font-bold flex items-center hover:bg-orange-200"><Plus size={16} className="mr-1"/> Tambah</button>
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={18} className="text-gray-400" /></div>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm" placeholder="Cari nama barang..." />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 text-gray-400 hover:text-gray-600"><X size={16} /></button>}
        </div>

        <div className="flex overflow-x-auto custom-scrollbar space-x-2 pb-2">
          {['Semua', ...categories].map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-orange-500 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {cat}
            </button>
          ))}
        </div>

        {renderCategoryManager()}

        <div className="grid grid-cols-1 gap-3">
          {filteredInv.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">Produk tidak ditemukan.</div>
          ) : (
            filteredInv.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 shrink-0"><Package size={20} /></div>
                  <div>
                    <p className="font-bold text-gray-800 line-clamp-1">{item.name}</p>
                    <div className="flex text-xs space-x-2 mt-0.5 items-center">
                      <span className="text-gray-500 font-medium">Jual: Rp {item.price.toLocaleString('id-ID')}</span>
                      <span className="text-orange-400 font-medium border-l border-gray-200 pl-2">Modal: Rp {(item.cost || 0).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  <div className="text-right mr-1">
                    <p className={`font-bold ${item.stock < 10 ? 'text-red-500' : 'text-gray-700'}`}>{item.stock}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Stok</p>
                  </div>
                  <div className="flex flex-col space-y-1.5 border-l pl-3 border-gray-100">
                    <button onClick={() => openProductModal(item)} className="p-1.5 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100"><Edit2 size={14} /></button>
                    <button onClick={() => setConfirmDialog({ isOpen: true, title: 'Hapus Produk?', message: 'Hapus produk ini permanen?', cancelText: 'Batal', actionText: 'Hapus', isDanger: true, action: () => { setInventory(prev => prev.filter(i => i.id !== item.id)); setConfirmDialog({isOpen: false}); }})} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={14} /></button>
                  </div>
                </div>
                {item.barcode && <div className="absolute top-1 left-1 text-gray-300"><Barcode size={12}/></div>}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderPiutangView = () => (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Daftar Kasbon</h2>
          <p className="text-xs text-gray-500 mt-1">Uang nyangkut di pelanggan</p>
        </div>
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-bold border border-red-100 text-right">
          Total Piutang<div className="text-sm">Rp {totalKasbon.toLocaleString('id-ID')}</div>
        </div>
      </div>
      {piutang.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} className="text-green-500" /></div>
          <h3 className="font-bold text-gray-800 mb-1">Syukurlah, Bersih!</h3>
          <p className="text-xs text-gray-500">Tidak ada pelanggan yang berutang saat ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {piutang.map(utang => (
            <div key={utang.id} className="bg-white p-5 rounded-3xl shadow-sm border border-red-100 relative overflow-hidden cursor-pointer hover:border-red-300 transition-colors" onClick={(e) => { if (e.target.tagName !== 'BUTTON') setSelectedReceipt(utang); }}>
              <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-[40px] flex items-start justify-end p-3"><CreditCard size={18} className="text-red-400" /></div>
              <h3 className="font-bold text-lg text-gray-900 mb-1 pr-12">{utang.customer_name}</h3>
              <p className="text-xs text-gray-400 mb-3">{utang.date} - {utang.time}</p>
              <div className="space-y-1 mb-4 border-l-2 border-red-100 pl-3">
                {utang.items.map((item, i) => <p key={i} className="text-sm text-gray-700 font-medium">{item.qty}x {item.name}</p>)}
              </div>
              <div className="flex items-end justify-between border-t border-gray-100 pt-4 mt-2">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Total Tagihan</p>
                  <p className="text-xl font-extrabold text-red-600 leading-none">Rp {utang.total_transaction.toLocaleString('id-ID')}</p>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => setConfirmDialog({ isOpen: true, title: 'Lunasi Kasbon?', message: `Tandai utang ${utang.customer_name} senilai Rp ${utang.total_transaction.toLocaleString('id-ID')} sebagai lunas?`, actionText: 'Lunasi', action: () => { setPiutang(prev => prev.filter(p => p.id !== utang.id)); setTransactions(prev => [{ ...utang, type: 'tunai', time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }, ...prev]); setAiInsights(prev => [`Alhamdulillah, kasbon ${utang.customer_name} lunas!`, ...prev]); setConfirmDialog({isOpen: false}); } })} className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-red-600 flex items-center z-10 relative">
                    <CheckCircle2 size={16} className="mr-1.5" /> Lunasi
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSettingsView = () => (
    <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Pengaturan Warung</h2>
      
      {/* Profil Usaha & Upload Logo */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center"><Store size={18} className="mr-2 text-orange-500"/> Profil Usaha</h3>
        
        <div className="flex items-center space-x-4 mb-6">
          <div className="relative w-16 h-16 bg-gray-50 rounded-full border border-dashed border-gray-300 overflow-hidden flex items-center justify-center shrink-0">
            {storeProfile.logo ? (
              <img src={storeProfile.logo} alt="Logo Usaha" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="text-gray-400" size={24}/>
            )}
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" title="Upload Logo Baru" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Logo Usaha</p>
            <p className="text-xs text-gray-500">Ketuk gambar untuk mengganti</p>
          </div>
        </div>

        <div className="space-y-4">
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nama Toko/Warung</label><input type="text" value={storeProfile.name} onChange={(e) => setStoreProfile({...storeProfile, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none" /></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">No. WhatsApp</label><input type="text" value={storeProfile.phone} onChange={(e) => setStoreProfile({...storeProfile, phone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none" /></div>
        </div>
      </div>

      <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
        <h3 className="font-bold text-sm text-blue-800 mb-2 flex items-center"><Bot size={18} className="mr-2"/> Gemini AI Key (Penting!)</h3>
        <p className="text-xs text-blue-600/80 mb-3 leading-relaxed">Paste API Key rahasia Anda dari Google AI Studio agar pemrosesan bahasa alami AI berfungsi penuh.</p>
        <div className="flex space-x-2">
          <input type="password" placeholder="AIzaSyA..." value={tempApiKeyInput} onChange={(e) => setTempApiKeyInput(e.target.value)} className="flex-1 bg-white border border-blue-200 rounded-xl p-3 focus:outline-none font-mono text-xs" />
          <button onClick={() => { setGeminiApiKey(tempApiKeyInput); setActiveTab('dashboard'); setAiInsights(prev => ["Kunci API Gemini berhasil disimpan! AI sudah siap digunakan.", ...prev]); }} className="bg-blue-500 text-white font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-blue-600 transition-colors text-sm">Simpan</button>
        </div>
      </div>

      {/* FAQ / QnA Section */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center"><HelpCircle size={18} className="mr-2 text-indigo-500"/> Pusat Bantuan (Q&A)</h3>
        <div className="space-y-3">
          {QNA_LIST.map((qna, idx) => (
            <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50/50">
              <button onClick={() => setActiveQnA(activeQnA === idx ? null : idx)} className="w-full flex justify-between items-center p-4 text-left focus:outline-none">
                <span className="text-sm font-bold text-gray-800 pr-4">{qna.q}</span>
                {activeQnA === idx ? <ChevronUp size={16} className="text-gray-500 shrink-0"/> : <ChevronDown size={16} className="text-gray-500 shrink-0"/>}
              </button>
              {activeQnA === idx && (
                <div className="px-4 pb-4 pt-1 text-xs text-gray-600 leading-relaxed border-t border-gray-100 bg-white">
                  {qna.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center"><Download size={18} className="mr-2 text-green-500"/> Pencadangan Data</h3>
        <div className={`mb-4 rounded-2xl border p-3 ${isBackupDue ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-bold ${isBackupDue ? 'text-yellow-800' : 'text-gray-700'}`}>
                {isBackupDue ? 'Saatnya backup data' : 'Status backup'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Terakhir: {lastBackupLabel}</p>
            </div>
            <select value={backupReminderInterval} onChange={(e) => setBackupReminderInterval(e.target.value)} className="bg-white border border-gray-200 rounded-xl px-2 py-2 text-xs font-bold text-gray-700 focus:outline-none">
              <option value="weekly">1 minggu</option>
              <option value="monthly">1 bulan</option>
              <option value="off">Nonaktif</option>
            </select>
          </div>
          <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">Data tersimpan di browser. Export backup berkala agar aman jika cache atau data Chrome dibersihkan.</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={exportBackupData} className="flex-1 bg-green-50 text-green-600 font-bold py-3 rounded-xl flex justify-center items-center"><Download size={16} className="mr-2"/> Export Data</button>
          
          <input type="file" ref={fileInputRef} onChange={(e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
              try { const parsed = JSON.parse(e.target.result);
                if (parsed.inventory) setInventory(parsed.inventory); if (parsed.transactions) setTransactions(parsed.transactions); if (parsed.piutang) setPiutang(parsed.piutang);
                if (parsed.aiInsights) setAiInsights(parsed.aiInsights); if (parsed.storeProfile) setStoreProfile(parsed.storeProfile);
                if (parsed.categories) setCategories(parsed.categories); if (parsed.backupReminderInterval) setBackupReminderInterval(parsed.backupReminderInterval);
                setAiInsights(prev => ["Data berhasil di-restore dari file backup.", ...prev]);
              } catch { alert("Format file backup tidak valid!"); }
            };
            reader.readAsText(file); e.target.value = '';
          }} accept=".json" className="hidden" />
          <button onClick={() => fileInputRef.current.click()} className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl flex justify-center items-center"><Upload size={16} className="mr-2"/> Import Data</button>
        </div>
      </div>

      <div className="bg-red-50 p-5 rounded-2xl border border-red-100 mt-8">
        <h3 className="font-bold text-sm text-red-700 mb-2 flex items-center"><Trash2 size={18} className="mr-2"/> Tutup Buku (Reset)</h3>
        <p className="text-xs text-red-600/80 mb-4">Hapus semua riwayat transaksi bulanan. Stok dan Kasbon akan tetap dipertahankan.</p>
        <button onClick={() => setConfirmDialog({ isOpen: true, title: 'Tutup Buku Sekarang?', message: 'Semua riwayat transaksi akan dihapus dari laporan. Yakin?', actionText: 'Tutup Buku', isDanger: true, action: executeTutupBuku })} className="w-full bg-red-100 text-red-600 font-bold py-3 rounded-xl flex justify-center items-center">Proses Tutup Buku</button>
      </div>

      <div className="pt-2 pb-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-100 px-3 py-2 shadow-sm">
          <ShieldCheck size={14} className="text-orange-500" />
          <span className="text-[11px] font-semibold text-gray-500">Dev: Achmad Zanuar</span>
          <a href="mailto:zanuarabdillah03@gmail.com" title="Email developer" className="w-7 h-7 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-colors">
            <Mail size={14} />
          </a>
        </div>
        <p className="mt-2 text-[10px] text-gray-400">Copyright 2026. All rights reserved.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      
      <header className="bg-white pt-12 pb-4 px-6 sticky top-0 z-10 rounded-b-3xl shadow-sm">
        <div className="flex justify-between items-center gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            {storeProfile.logo && (
              <img src={storeProfile.logo} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-orange-200 shadow-sm" />
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 flex items-center sm:text-2xl">WarungPulse <span className="text-orange-500 ml-1">AI</span></h1>
              <p className="text-xs text-gray-500 font-medium">Co-Pilot Bisnis Anda</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {deferredInstallPrompt && !isStandaloneApp && (
              <button onClick={installApp} className="h-10 bg-orange-500 text-white rounded-full flex items-center justify-center gap-1.5 px-3 text-xs font-bold shadow-md shadow-orange-200 hover:bg-orange-600 transition-colors">
                <Download size={16} />
                <span>Install</span>
              </button>
            )}
            <button onClick={() => setActiveTab('settings')} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"><Settings size={20} /></button>
          </div>
        </div>
      </header>

      {!isOnline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 text-yellow-900">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold">Mode offline</p>
              <p className="text-[11px] leading-relaxed text-yellow-800">Data lokal masih bisa dibuka. Fitur AI dan sinkronisasi internet tidak tersedia sementara.</p>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
        {activeTab === 'dashboard' && renderDashboardView()}
        {activeTab === 'transactions' && renderTransactionView()}
        {activeTab === 'kasbon' && renderPiutangView()}
        {activeTab === 'inventory' && renderInventoryView()}
        {activeTab === 'settings' && renderSettingsView()}
      </main>

      <nav className="bg-white border-t border-gray-100 px-4 py-4 flex justify-between items-center sticky bottom-0 z-20 pb-safe">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center p-2 ${activeTab === 'dashboard' ? 'text-orange-500' : 'text-gray-400'}`}><LayoutDashboard size={20} /><span className="text-[10px] font-semibold mt-1">Beranda</span></button>
        <button onClick={() => setActiveTab('kasbon')} className={`flex flex-col items-center p-2 relative ${activeTab === 'kasbon' ? 'text-orange-500' : 'text-gray-400'}`}><CreditCard size={20} /><span className="text-[10px] font-semibold mt-1">Kasbon</span>{piutang.length > 0 && <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}</button>
        <div className="w-16"></div> 
        <button onClick={() => setActiveTab('transactions')} className={`flex flex-col items-center p-2 ${activeTab === 'transactions' ? 'text-orange-500' : 'text-gray-400'}`}><History size={20} /><span className="text-[10px] font-semibold mt-1">Riwayat</span></button>
        <button onClick={() => setActiveTab('inventory')} className={`flex flex-col items-center p-2 ${activeTab === 'inventory' ? 'text-orange-500' : 'text-gray-400'}`}><Package size={20} /><span className="text-[10px] font-semibold mt-1">Produk</span></button>
      </nav>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-end space-x-4">
        <div className="flex flex-col items-center">
          <button onClick={() => setIsScannerOpen(true)} className="w-12 h-12 bg-white text-gray-800 rounded-full flex items-center justify-center shadow-lg border border-gray-200" title="Scan barcode"><Barcode size={22} /></button>
          <span className="mt-1 text-[10px] font-semibold text-gray-500">Scan</span>
        </div>
        <div className="flex flex-col items-center -mb-1">
          <button onClick={() => setIsModalOpen(true)} className="w-16 h-16 bg-gradient-to-br from-[#431407] to-[#5a1c0a] rounded-full flex items-center justify-center shadow-xl shadow-orange-900/20 text-white border-4 border-[#f8f9fa]" title="Catat transaksi"><Mic size={26} className="text-orange-300" /></button>
          <span className="mt-1 text-[10px] font-bold text-orange-700">Catat</span>
        </div>
      </div>

      {/* Scanner Modal */}
      {isScannerOpen && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-[70] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm flex flex-col items-center">
            <h3 className="text-white font-bold text-xl mb-2 flex items-center"><Camera className="mr-2" /> Scan Barcode</h3>
            <p className="text-gray-400 text-sm text-center mb-8">Arahkan kamera ke kemasan produk (Indomie, Sabun) untuk jualan cepat.</p>
            <div className="w-full aspect-square bg-black rounded-3xl overflow-hidden border-2 border-orange-500 relative mb-6">
               <div id="reader" className="w-full h-full"></div>
            </div>
            <div className="w-full flex space-x-2">
              <input type="text" value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)} placeholder="Atau ketik barcode manual..." className="flex-1 bg-white/10 border border-white/20 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-orange-500 text-sm" />
              <button onClick={() => handleScannedBarcode(manualBarcode)} className="bg-orange-500 text-white font-bold px-6 py-3 rounded-xl">Proses</button>
            </div>
            <button onClick={() => setIsScannerOpen(false)} className="mt-8 text-white/50 hover:text-white font-bold py-2 px-4 border border-white/20 rounded-full">Batal Scan</button>
          </div>
        </div>
      )}

      {/* Voice Input Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl border-t border-orange-100 relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center"><Bot size={24} className="text-orange-500 mr-2" /> Catat Transaksi</h3>
              <button onClick={() => { setIsModalOpen(false); recognitionRef.current?.stop(); setIsListening(false); }} className="bg-gray-100 p-2 rounded-full text-gray-500"><X size={20} /></button>
            </div>
            <div className="relative mb-6">
              <div className={`w-full border-2 rounded-2xl p-4 transition-colors ${isListening ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                {isListening ? (
                  <div className="flex items-center space-x-2 text-orange-600 mb-2"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span><span className="text-xs font-bold uppercase">Mendengarkan...</span></div>
                ) : (
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Input Teks / Suara</div>
                )}
                <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Contoh: 'Jual 2 kopi' atau paste chat WA di sini..." className="w-full bg-transparent border-none focus:ring-0 resize-none text-lg text-gray-800 placeholder:text-gray-300 min-h-[100px]" />
              </div>
              <button onClick={() => { if(isListening){recognitionRef.current?.stop(); setIsListening(false);} else{setTranscript(''); recognitionRef.current?.start(); setIsListening(true);} }} className={`absolute right-4 bottom-4 p-3 rounded-full shadow-md transition-all ${isListening ? 'bg-red-500 text-white animate-bounce' : 'bg-white text-gray-600 border border-gray-200'}`}>{isListening ? <MicOff size={20} /> : <Mic size={20} />}</button>
            </div>
            <div className="space-y-4">
              <button onClick={() => processTransactionWithAI(transcript)} disabled={!transcript.trim() || isProcessingAI} className="w-full bg-orange-500 disabled:bg-gray-300 text-white font-bold text-lg py-4 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200 disabled:shadow-none">
                {isProcessingAI ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>AI Sedang Memproses...</>) : (<><Send size={20} className="mr-2" /> Proses Perintah AI</>)}
              </button>
              {lastParsedData && (
                <div className={`p-4 rounded-xl border flex items-start ${lastParsedData.type === 'tambah_stok' ? 'bg-indigo-50 border-indigo-200' : (lastParsedData.type === 'kasbon' ? 'bg-red-50 border-red-200' : (lastParsedData.type === 'pengeluaran' ? 'bg-gray-100 border-gray-300' : 'bg-green-50 border-green-200'))}`}>
                  <CheckCircle2 className={`${lastParsedData.type === 'tambah_stok' ? 'text-indigo-500' : (lastParsedData.type === 'kasbon' ? 'text-red-500' : (lastParsedData.type === 'pengeluaran' ? 'text-gray-600' : 'text-green-500'))} mr-3 shrink-0`} size={24} />
                  <div className="flex-1">
                    <p className={`text-sm font-bold mb-1 ${lastParsedData.type === 'tambah_stok' ? 'text-indigo-800' : (lastParsedData.type === 'kasbon' ? 'text-red-800' : (lastParsedData.type === 'pengeluaran' ? 'text-gray-800' : 'text-green-800'))}`}>
                      {lastParsedData.type === 'tambah_stok' ? 'Masuk Katalog!' : (lastParsedData.type === 'kasbon' ? `Kasbon: ${lastParsedData.customer_name}` : (lastParsedData.type === 'pengeluaran' ? 'Pengeluaran Dicatat!' : 'Transaksi Lunas!'))}
                    </p>
                    <p className={`text-xs ${lastParsedData.type === 'tambah_stok' ? 'text-indigo-700' : (lastParsedData.type === 'kasbon' ? 'text-red-700' : (lastParsedData.type === 'pengeluaran' ? 'text-gray-600' : 'text-green-700'))}`}>Total: Rp {lastParsedData.total_transaction.toLocaleString('id-ID')}</p>
                    <div className="flex space-x-4 mt-3">
                      <button onClick={() => setLastParsedData(null)} className="text-xs font-bold underline">Lanjut</button>
                      {lastParsedData.type !== 'tambah_stok' && <button onClick={() => { shareToWhatsApp(lastParsedData); setLastParsedData(null); setIsModalOpen(false); }} className="text-xs font-bold flex items-center"><Share2 size={12} className="mr-1"/> Bagikan Struk</button>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {isProductModalOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="bg-gray-100 p-2 rounded-full"><X size={20} /></button>
            </div>
            <form onSubmit={saveProduct} className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Produk</label><input type="text" required value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} className="w-full bg-gray-50 border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-orange-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modal</label><input type="number" required min="0" value={productForm.cost} onChange={(e) => setProductForm({...productForm, cost: e.target.value})} className="w-full bg-gray-50 border rounded-xl p-3 focus:outline-none" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jual</label><input type="number" required min="0" value={productForm.price} onChange={(e) => setProductForm({...productForm, price: e.target.value})} className="w-full bg-gray-50 border rounded-xl p-3 focus:outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stok</label><input type="number" required min="0" value={productForm.stock} onChange={(e) => setProductForm({...productForm, stock: e.target.value})} className="w-full bg-gray-50 border rounded-xl p-3 focus:outline-none" /></div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kategori</label>
                  <select value={productForm.category} onChange={(e) => setProductForm({...productForm, category: e.target.value})} className="w-full bg-gray-50 border rounded-xl p-3 text-sm focus:outline-none">
                    {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center"><Barcode size={12} className="mr-1"/> Barcode</label>
                <input type="text" value={productForm.barcode} onChange={(e) => setProductForm({...productForm, barcode: e.target.value})} className="w-full bg-gray-50 border rounded-xl p-3 focus:outline-none font-mono text-sm" />
              </div>
              <button type="submit" className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl mt-6 shadow-md hover:bg-orange-600">Simpan Produk</button>
            </form>
          </div>
        </div>
      )}

      {/* Digital Receipt Modal */}
      {selectedReceipt && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-t-lg rounded-b-3xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="h-4 bg-white w-full relative" style={{ backgroundImage: 'radial-gradient(circle at 10px -5px, transparent 12px, white 13px)', backgroundSize: '20px 20px', backgroundPosition: '-10px 0' }}></div>
            <div className="px-6 py-4 flex-1 overflow-y-auto custom-scrollbar">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-2 flex items-center justify-center overflow-hidden border border-gray-200">
                  {storeProfile.logo ? (
                    <img src={storeProfile.logo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <FileText size={24} className="text-gray-400" />
                  )}
                </div>
                <h3 className="font-bold text-lg text-gray-900 uppercase">{storeProfile.name}</h3>
                {storeProfile.phone && <p className="text-xs text-gray-500 mb-1">WA: {storeProfile.phone}</p>}
                <p className="text-xs text-gray-500">{selectedReceipt.date} - {selectedReceipt.time}</p>
              </div>
              {selectedReceipt.type === 'kasbon' && <div className="bg-red-50 text-red-600 text-xs font-bold p-2 text-center rounded-lg mb-4 uppercase">KASBON: {selectedReceipt.customer_name}</div>}
              {selectedReceipt.type === 'pengeluaran' && <div className="bg-gray-100 text-gray-700 text-xs font-bold p-2 text-center rounded-lg mb-4 uppercase">BIAYA PENGELUARAN</div>}
              {selectedReceipt.notes && <div className="bg-orange-50 border border-orange-100 text-orange-800 text-xs p-3 rounded-lg mb-4 italic"><span className="font-bold mr-1">Catatan:</span> {selectedReceipt.notes}</div>}
              <div className="border-t border-b border-dashed border-gray-300 py-4 mb-4 space-y-2">
                {selectedReceipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm"><span className="text-gray-600">{selectedReceipt.type !== 'pengeluaran' ? `${item.qty}x ` : ''}{item.name}</span><span className="font-medium">Rp {item.subtotal.toLocaleString('id-ID')}</span></div>
                ))}
              </div>
              <div className="flex justify-between items-center text-lg font-bold text-gray-900 mb-8"><span>TOTAL</span><span>Rp {selectedReceipt.total_transaction.toLocaleString('id-ID')}</span></div>
            </div>
            <div className="p-4 bg-gray-50 rounded-b-3xl border-t border-gray-100 flex space-x-3">
               <button onClick={() => setSelectedReceipt(null)} className="flex-1 bg-white border border-gray-200 text-gray-600 font-bold py-3 rounded-xl">Tutup</button>
              <button onClick={() => { shareToWhatsApp(selectedReceipt); setSelectedReceipt(null); }} className="flex-1 bg-green-500 text-white font-bold py-3 rounded-xl flex items-center justify-center"><Share2 size={18} className="mr-2" /> Share WA</button>
            </div>
          </div>
        </div>
      )}

      {/* Global Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmDialog.isDanger ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}><AlertCircle size={32} /></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-gray-500 mb-6">{confirmDialog.message}</p>
            <div className="flex space-x-3">
              <button onClick={() => setConfirmDialog({isOpen: false})} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl">{confirmDialog.cancelText}</button>
              {confirmDialog.action && <button onClick={confirmDialog.action} className={`flex-1 text-white font-bold py-3 rounded-xl shadow-lg ${confirmDialog.isDanger ? 'bg-red-500 shadow-red-200 hover:bg-red-600' : 'bg-orange-500 shadow-orange-200 hover:bg-orange-600'}`}>{confirmDialog.actionText}</button>}
            </div>
          </div>
        </div>
      )}

      <style>{`.pb-safe{padding-bottom: env(safe-area-inset-bottom);}.custom-scrollbar::-webkit-scrollbar{width:4px;height:4px;}.custom-scrollbar::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px;}`}</style>
    </div>
  );
}
