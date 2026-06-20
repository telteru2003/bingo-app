"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../src/lib/supabaseClient";
import { Camera, QrCode, X, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import QRCode from "react-qr-code";
import confetti from "canvas-confetti";
import { useTheme } from "../src/components/ThemeProvider";

interface TalkTheme {
  id: number | string;
  content: string;
}

interface Employee {
  id: string | number;
  name?: string;
  is_rare?: boolean;
  [key: string]: any;
}

type CellData =
  | { type: "free"; isOpen: boolean }
  | { type: "employee"; employee: Employee; isOpen: boolean };

const generatePin = (id: string | number) => {
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash) % 10000).padStart(4, '0');
};

export default function BingoPage() {
  const [cells, setCells] = useState<CellData[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [talkThemes, setTalkThemes] = useState<TalkTheme[]>([]);
  const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(null);
  const [currentTalkTheme, setCurrentTalkTheme] = useState<TalkTheme | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isShowMyQr, setIsShowMyQr] = useState(false);
  const [isReach, setIsReach] = useState(false);
  const [isBingo, setIsBingo] = useState(false);
  const [showReachAnim, setShowReachAnim] = useState(false);
  const [showBingoAnim, setShowBingoAnim] = useState(false);
  const [showRareAnim, setShowRareAnim] = useState(false);
  const [rareEmployeeName, setRareEmployeeName] = useState("");
  
  const [playerName, setPlayerName] = useState<string>("");
  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const [inputName, setInputName] = useState<string>("");
  const [selectedFavoriteEmployees, setSelectedFavoriteEmployees] = useState<string[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [hasResetOnce, setHasResetOnce] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState("");
  const { theme } = useTheme();

  const handleResetData = async () => {
    if (hasResetOnce) return;
    localStorage.setItem("hasResetOnce", "true");
    setHasResetOnce(true);

    const name = playerName || localStorage.getItem("playerName");
    if (name) {
      await supabase.from('bingo_logs').insert([{
        player_id: name,
        player_name: name,
        event_type: 'reset'
      }]);
    }
    localStorage.removeItem("playerName");
    localStorage.removeItem("bingoCells");
    setPlayerName("");
    setCells([]);
    setInputName("");
    setSelectedFavoriteEmployees([]);
    setIsBingo(false);
    setIsReach(false);
    setShowResetConfirm(false);
    setShowNameModal(true);
  };

  const checkResetStatus = async (name: string) => {
    const { data } = await supabase
      .from('bingo_logs')
      .select('id')
      .eq('player_name', name)
      .eq('event_type', 'reset')
      .limit(1);
    
    if (data && data.length > 0) {
      setHasResetOnce(true);
      localStorage.setItem("hasResetOnce", "true");
    } else {
      setHasResetOnce(false);
      localStorage.removeItem("hasResetOnce");
    }
  };

  useEffect(() => {
    const storedName = localStorage.getItem("playerName");
    const storedCells = localStorage.getItem("bingoCells");
    const resetFlag = localStorage.getItem("hasResetOnce");

    if (resetFlag === "true") {
      setHasResetOnce(true);
    }

    if (storedName) {
      setPlayerName(storedName);
      setInputName(storedName); // すでに名前があれば入力欄の初期値にする
      checkResetStatus(storedName);
    }

    if (storedCells) {
      try {
        const parsedCells = JSON.parse(storedCells);
        if (Array.isArray(parsedCells) && parsedCells.length === 25) {
          setCells(parsedCells);
        } else {
          setShowNameModal(true);
        }
      } catch (err) {
        console.error("Failed to parse stored cells", err);
        setShowNameModal(true);
      }
    } else {
      setShowNameModal(true);
    }
  }, []);

  useEffect(() => {
    if (!playerName) return;

    const channel = supabase
      .channel(`sync_reset_logs_${playerName}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bingo_logs',
        },
        () => {
          checkResetStatus(playerName);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerName]);

  const sendLog = async (eventType: 'open' | 'reach' | 'bingo', targetEmployeeId?: string | number) => {
    const name = playerName || localStorage.getItem("playerName");
    if (!name) return;
    
    try {
      const payload: any = {
        player_id: name,
        player_name: name,
        event_type: eventType,
      };
      if (targetEmployeeId !== undefined) {
        payload.target_employee_id = targetEmployeeId;
      }
      
      const { error } = await supabase.from("bingo_logs").insert([payload]);
      if (error) {
        console.error("ログ送信エラー:", error);
      }
    } catch (err) {
      console.error("ログ送信の予期せぬエラー:", err);
    }
  };

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoading(true);

        const [empResponse, themeResponse] = await Promise.all([
          supabase.from("employees").select("*"),
          supabase.from("talk_themes").select("*")
        ]);

        if (empResponse.error) {
          console.error("社員データの取得に失敗しました:", empResponse.error);
          return;
        }

        if (themeResponse.data) {
          setTalkThemes(themeResponse.data);
        }

        const data = empResponse.data;

        if (data) {
          const sortedData = [...data].sort((a, b) => {
            const nameA = a.name || "";
            const nameB = b.name || "";
            return nameA.localeCompare(nameB, 'ja');
          });
          setAllEmployees(sortedData);
        }
      } catch (err) {
        console.error("予期せぬエラーが発生しました:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  useEffect(() => {
    if (cells.length !== 25) return;

    const lines = [
      [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24], // rows
      [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24], // cols
      [0, 6, 12, 18, 24], [4, 8, 12, 16, 20] // diagonals
    ];

    let hasReach = false;
    let hasBingo = false;

    for (const line of lines) {
      const openCount = line.filter((index) => cells[index]?.isOpen).length;
      if (openCount === 5) {
        hasBingo = true;
      } else if (openCount === 4) {
        hasReach = true;
      }
    }

    if (hasBingo && !isBingo) {
      if (showRareAnim) return;
      setIsBingo(true);
      setShowBingoAnim(true);
      sendLog('bingo');
      confetti({
        particleCount: 400,
        spread: 160,
        startVelocity: 50,
        origin: { y: 0.3 },
        zIndex: 9999,
        colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
      });
      setTimeout(() => setShowBingoAnim(false), 5000);
    } else if (hasReach && !hasBingo && !isReach) {
      if (showRareAnim) return;
      setIsReach(true);
      setShowReachAnim(true);
      sendLog('reach');
      setTimeout(() => setShowReachAnim(false), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, isReach, isBingo, showRareAnim, playerName]);

  const handleCellClick = (index: number) => {
    const cell = cells[index];
    if (cell.type === "free" || cell.isOpen) return;

    if (talkThemes.length > 0) {
      const randomIndex = Math.floor(Math.random() * talkThemes.length);
      setCurrentTalkTheme(talkThemes[randomIndex]);
    } else {
      setCurrentTalkTheme(null);
    }
    
    setSelectedCellIndex(index);
    setIsScannerOpen(false);
    setIsShowMyQr(false);
  };

  const handleOpenCell = (index: number) => {
    const cell = cells[index];
    setCells(prevCells => {
      const newCells = prevCells.map((c, i) =>
        i === index ? { ...c, isOpen: true } : c
      );
      localStorage.setItem("bingoCells", JSON.stringify(newCells));
      return newCells;
    });
    
    if (cell && cell.type === "employee") {
      sendLog('open', cell.employee.id);
    }
    
    if (cell && cell.type === "employee" && cell.employee.is_rare) {
      setShowRareAnim(true);
      setRareEmployeeName(cell.employee.name || "");
      confetti({
        particleCount: 200,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#FFD700', '#FFA500', '#FFFFFF', '#FF8C00'],
        zIndex: 9999
      });
      setTimeout(() => setShowRareAnim(false), 3500);
    }
  };

  const startScanner = () => {
    setIsScannerOpen(true);
    setIsShowMyQr(false);
    setTimeout(async () => {
      try {
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode("reader");
        }
        await html5QrCodeRef.current.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          (errorMessage) => {}
        );
      } catch (err) {
        console.error("カメラの起動に失敗しました", err);
        alert("カメラの起動に失敗しました。権限を確認してください。");
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      await html5QrCodeRef.current.stop();
      html5QrCodeRef.current.clear();
    }
    setIsScannerOpen(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (selectedCellIndex === null) return;
    const cell = cells[selectedCellIndex];
    if (cell.type === "employee") {
      if (String(cell.employee.id) === decodedText) {
        await stopScanner();
        handleOpenCell(selectedCellIndex);
        setSelectedCellIndex(null);
        setIsShowMyQr(false);
      } else {
        console.log("QRコードが一致しません");
      }
    }
  };

  const closeModal = async () => {
    if (isScannerOpen) {
      await stopScanner();
    }
    setSelectedCellIndex(null);
    setIsShowMyQr(false);
    setInputPin("");
    setPinError("");
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      localStorage.setItem("playerName", inputName.trim());
      setPlayerName(inputName.trim());
      checkResetStatus(inputName.trim());
      
      const remainingEmployees = allEmployees.filter(
        emp => !selectedFavoriteEmployees.includes(String(emp.id)) && emp.name !== inputName.trim()
      );
      
      const favorites = allEmployees.filter(
        emp => selectedFavoriteEmployees.includes(String(emp.id)) && emp.name !== inputName.trim()
      );
      
      const shuffledRemaining = [...remainingEmployees].sort(() => 0.5 - Math.random());
      const neededCount = 24 - favorites.length;
      const selectedRemaining = shuffledRemaining.slice(0, neededCount);
      
      const combined = [...favorites, ...selectedRemaining].sort(() => 0.5 - Math.random());
      
      const newCells: CellData[] = [];
      let employeeIndex = 0;

      for (let i = 0; i < 25; i++) {
        if (i === 12) {
          newCells.push({ type: "free", isOpen: true });
        } else {
          const emp = combined[employeeIndex] || {
            id: `dummy-${i}`,
            name: `社員${employeeIndex + 1}`,
          };
          newCells.push({
            type: "employee",
            employee: emp,
            isOpen: false,
          });
          employeeIndex++;
        }
      }

      setCells(newCells);
      localStorage.setItem("bingoCells", JSON.stringify(newCells));
      
      setShowNameModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cell-bg transition-colors flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-md"></div>
          <p className="text-text-main transition-colors font-medium text-sm sm:text-base">
            社員データを読み込み中...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-bg-from to-bg-to flex flex-col items-center py-8 px-4 sm:py-12 transition-colors">
      <div className="w-full max-w-lg">
        {/* ヘッダーエリア */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500 tracking-widest drop-shadow-sm">
            BINGO
          </h1>
          <p className="text-text-muted transition-colors text-sm mt-3 font-medium bg-white/50 inline-block px-4 py-1.5 rounded-full shadow-sm">
            社員BINGOで楽しく交流しよう！
          </p>
        </div>

        {/* ビンゴボードエリア */}
        <div className="bg-card-bg transition-colors p-3 sm:p-5 rounded-3xl shadow-xl border border-gray-100/80">
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {cells.map((cell, index) => {
              const isFree = cell.type === "free";
              const isOpen = cell.isOpen;

              return (
                <button
                  key={index}
                  onClick={() => handleCellClick(index)}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center
                    rounded-xl sm:rounded-2xl shadow-sm text-xs font-bold transition-all duration-300 ease-out
                    overflow-hidden border-2
                    ${isFree
                      ? "bg-gradient-to-br from-yellow-300 to-orange-400 border-yellow-400 text-white shadow-md transform scale-100"
                      : isOpen
                        ? (cell.type === "employee" && cell.employee.is_rare)
                          ? "bg-gradient-to-br from-yellow-400 via-amber-300 to-yellow-500 border-yellow-400 text-yellow-900 shadow-[inset_0_2px_10px_rgba(255,255,255,0.5),0_0_15px_rgba(250,204,21,0.6)] scale-[0.97] animate-[pulse_2s_ease-in-out_infinite]"
                          : "bg-indigo-500 border-indigo-600 text-white shadow-inner scale-[0.97]"
                        : "bg-cell-bg border-cell-border text-cell-text transition-colors hover:bg-indigo-50 hover:border-indigo-200 hover:scale-[1.02] active:scale-[0.97]"
                    }
                  `}
                >
                  {isFree ? (
                    <span className="drop-shadow-md text-sm sm:text-xl tracking-wider">
                      FREE
                    </span>
                  ) : (
                    <span className="text-center leading-tight px-1 break-words w-full line-clamp-3">
                      {cell.type === "employee" ? cell.employee.name || "No Name" : ""}
                    </span>
                  )}

                  {/* 開いている状態の時のオーバーレイ効果 */}
                  {isOpen && !isFree && (
                    <div className="absolute inset-0 bg-black/5 rounded-xl sm:rounded-2xl"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* フッターアクション（スマホ向けレスポンシブ配置） */}
        <div className="mt-8 flex justify-between items-end pb-8 w-full max-w-sm mx-auto px-2">
          {/* 左：遊び方 */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex flex-col items-center gap-1.5 text-indigo-500 hover:text-indigo-700 transition-colors flex-1"
          >
            <div className="bg-white border border-indigo-100 p-3 rounded-2xl shadow-sm active:scale-95 transition-transform">
              <HelpCircle size={22} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold tracking-wide">遊び方</span>
          </button>

          {/* 中央：マイQR */}
          <button
            onClick={() => setIsShowMyQr(true)}
            className="flex flex-col items-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors flex-1 relative z-10"
          >
            <div className="bg-white border-2 border-indigo-200 p-4 rounded-3xl shadow-md transform -translate-y-2 active:scale-95 transition-transform">
              <QrCode size={28} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold tracking-wide text-indigo-600">マイQR</span>
          </button>

          {/* 右：リセット */}
          <button
            onClick={() => !hasResetOnce && setShowResetConfirm(true)}
            disabled={hasResetOnce}
            className={`flex flex-col items-center gap-1.5 transition-colors flex-1 ${
              hasResetOnce ? "text-gray-300 cursor-not-allowed opacity-50" : "text-red-400 hover:text-red-600"
            }`}
          >
            <div className={`border p-3 rounded-2xl shadow-sm ${
              hasResetOnce ? "bg-cell-bg transition-colors border-gray-100" : "bg-white border-red-100 active:scale-95 transition-transform"
            }`}>
              <AlertTriangle size={22} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold tracking-wide">{hasResetOnce ? "リセット済" : "リセット"}</span>
          </button>
        </div>
      </div>

      {/* モーダル */}
      {selectedCellIndex !== null && cells[selectedCellIndex] && cells[selectedCellIndex].type === "employee" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-text-main transition-colors bg-button-light transition-colors p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-2xl font-bold text-text-main transition-colors mb-2">
              {(cells[selectedCellIndex] as any).employee.name || "名前なし"}
            </h2>

            {currentTalkTheme && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 w-full text-center">
                <p className="text-xs text-indigo-400 font-bold mb-1 tracking-wider">TALK THEME</p>
                <p className="text-indigo-900 font-medium">{currentTalkTheme.content}</p>
              </div>
            )}

            {!isScannerOpen && (
              <div className="flex flex-col gap-3 w-full mt-2">
                <button
                  onClick={() => {
                    if (talkThemes.length > 0) {
                      const randomIndex = Math.floor(Math.random() * talkThemes.length);
                      setCurrentTalkTheme(talkThemes[randomIndex]);
                    }
                  }}
                  className="flex items-center justify-center gap-2 bg-white border-2 border-indigo-100 hover:bg-indigo-50 text-indigo-600 font-bold py-2 px-4 rounded-xl transition-all active:scale-[0.98]"
                >
                  <RefreshCw size={18} />
                  別のテーマにする
                </button>
                <button
                  onClick={startScanner}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  <Camera size={20} />
                  QRを読み取ってマスを開ける
                </button>
                
                {/* 番号入力エリア */}
                <div className="flex flex-col gap-2 bg-cell-bg transition-colors p-4 rounded-xl border border-gray-200 mt-2">
                  <p className="text-xs text-center text-text-muted transition-colors font-bold">または4ケタのPIN番号を入力して開ける</p>
                  <div className="flex items-center justify-center gap-3">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="0000"
                      value={inputPin}
                      onChange={(e) => {
                        setInputPin(e.target.value.replace(/[^0-9]/g, ''));
                        setPinError("");
                      }}
                      className="w-32 text-center text-2xl font-mono font-extrabold tracking-widest p-2 rounded-lg border-2 border-gray-400 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <button
                      onClick={() => {
                        if (selectedCellIndex === null) return;
                        const cell = cells[selectedCellIndex];
                        if (cell?.type === "employee") {
                          const correctPin = generatePin(cell.employee.id);
                          if (inputPin === correctPin) {
                            handleOpenCell(selectedCellIndex);
                            closeModal();
                          } else {
                            setPinError("番号が違います");
                          }
                        }
                      }}
                      disabled={inputPin.length !== 4}
                      className="bg-indigo-600 disabled:bg-gray-300 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold transition-colors"
                    >
                      開ける
                    </button>
                  </div>
                  {pinError && <p className="text-xs text-red-500 text-center font-bold">{pinError}</p>}
                </div>
              </div>
            )}

            {isScannerOpen && (
              <div className="w-full flex flex-col items-center">
                <div id="reader" className="w-full max-w-[250px] overflow-hidden rounded-xl bg-black mb-4"></div>
                <button
                  onClick={stopScanner}
                  className="bg-button-light transition-colors hover:bg-gray-200 text-cell-text transition-colors font-bold py-2 px-6 rounded-full transition-colors mt-4"
                >
                  カメラを閉じる
                </button>
              </div>
            )}



            {/* 開発環境用デバッグ機能：QRスキャンなしでマスを開ける */}
            {process.env.NODE_ENV === "development" && (
              <button
                onClick={() => {
                  handleOpenCell(selectedCellIndex);
                  closeModal();
                }}
                className="mt-6 text-xs text-gray-400 hover:text-text-main transition-colors underline"
              >
                [デバッグ] 強制的にマスを開ける
              </button>
            )}
          </div>
        </div>
      )}

      {/* マイQRモーダル */}
      {isShowMyQr && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center">
            <button
              onClick={() => setIsShowMyQr(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-text-main transition-colors bg-button-light transition-colors p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-text-main transition-colors mb-4">マイQRコード</h2>
            <div className="bg-white w-full rounded-xl border-2 border-indigo-50 mb-4 flex flex-col items-center overflow-hidden">
              <div className="p-4">
                <QRCode 
                  value={(() => {
                    const currentPlayer = allEmployees.find(emp => emp.name === playerName);
                    return currentPlayer ? String(currentPlayer.id) : playerName;
                  })()} 
                  size={160} 
                />
              </div>
              <div className="bg-cell-bg transition-colors w-full py-3 border-t border-gray-100 flex flex-col items-center">
                <p className="text-[10px] text-text-muted transition-colors mb-0.5 font-bold">番号入力用 PIN</p>
                <p className="text-3xl font-mono tracking-widest text-indigo-700 font-extrabold">
                  {(() => {
                    const currentPlayer = allEmployees.find(emp => emp.name === playerName);
                    return currentPlayer ? generatePin(currentPlayer.id) : "----";
                  })()}
                </p>
              </div>
            </div>
            <p className="text-sm text-text-muted transition-colors mb-4 text-center leading-relaxed">
              相手にQRを読み取ってもらうか、<br />上記のPIN番号を伝えてください
            </p>
          </div>
        </div>
      )}

      {/* リーチ演出 */}
      {showReachAnim && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="text-6xl sm:text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-2xl animate-bounce">
            リーチ！
          </div>
        </div>
      )}

      {/* ビンゴ演出 */}
      {showBingoAnim && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-black/10 transition-opacity duration-500">
          <div className="text-7xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-bounce scale-110">
            BINGO!!!
          </div>
        </div>
      )}

      {/* レアキャラ演出 */}
      {showRareAnim && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center pointer-events-none bg-black/40 transition-opacity duration-300">
          <div className="text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 drop-shadow-[0_0_20px_rgba(255,215,0,1)] animate-bounce mb-4">
            SUPER RARE!!
          </div>
          <div className="text-3xl sm:text-5xl font-bold text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] animate-pulse">
            {rareEmployeeName} 発見！
          </div>
        </div>
      )}

      {/* リセット確認モーダル */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="text-red-500" size={24} />
            </div>
            <h2 className="text-xl font-bold text-text-main transition-colors mb-2">データをリセットしますか？</h2>
            <p className="text-sm text-text-muted transition-colors mb-6 text-center">
              現在のプレイヤーデータと<br />ビンゴの進行状況がすべて消去されます。<br />この操作は元に戻せません。
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-button-light transition-colors hover:bg-gray-200 text-cell-text transition-colors font-bold py-3 px-4 rounded-xl transition-colors"
              >
                NO
              </button>
              <button
                onClick={handleResetData}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
              >
                YES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ヘルプモーダル */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-text-main transition-colors bg-button-light transition-colors p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-text-main transition-colors mb-4 flex items-center gap-2">
              <HelpCircle className="text-indigo-500" />
              遊び方
            </h2>
            <div className="text-sm text-text-main transition-colors space-y-4 mb-6">
              <div className="flex gap-3">
                <span className="font-bold text-indigo-500 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">1</span>
                <p>マスに書かれた名前の社員に声をかけよう！</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-indigo-500 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">2</span>
                <p>マスをタップするとお題が出るので、そのトークテーマについて話します。</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-indigo-500 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">3</span>
                <p>話が終わったら、相手に「マイQR」を見せてもらい、自分のカメラで読み取ります。</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-indigo-500 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">4</span>
                <p>QRが一致するとマスが開きます！縦・横・斜めのどれか一列揃うとBINGOです！</p>
              </div>
            </div>
            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              とじる
            </button>
          </div>
        </div>
      )}

      {/* プレイヤー名登録モーダル */}
      {showNameModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center">
            <h2 className="text-2xl font-bold text-text-main transition-colors mb-4">プレイヤー名を登録</h2>
            <p className="text-sm text-text-muted transition-colors mb-6 text-center">
              ビンゴに参加するための<br />あなたの名前を入力してください。
            </p>
            <form onSubmit={handleNameSubmit} className="w-full flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-cell-text transition-colors">あなたの名前</label>
                <select
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  autoFocus
                >
                  <option value="" disabled>名前を選択してください</option>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.name || ""}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-cell-text transition-colors">
                  お気に入り社員（最大10名まで: 現在 {selectedFavoriteEmployees.length}名）
                </label>
                <div className="border border-gray-200 rounded-xl max-h-72 overflow-y-auto p-2 bg-cell-bg transition-colors flex flex-col gap-2">
                  {allEmployees
                    .filter((emp) => emp.name !== inputName)
                    .map((emp) => {
                    const isSelected = selectedFavoriteEmployees.includes(String(emp.id));
                    const isDisabled = !isSelected && selectedFavoriteEmployees.length >= 10;
                    return (
                      <label 
                        key={emp.id} 
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-100 border border-indigo-200' : 'hover:bg-button-light transition-colors border border-transparent'
                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          disabled={isDisabled}
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (selectedFavoriteEmployees.length < 10) {
                                setSelectedFavoriteEmployees([...selectedFavoriteEmployees, String(emp.id)]);
                              }
                            } else {
                              setSelectedFavoriteEmployees(selectedFavoriteEmployees.filter(id => id !== String(emp.id)));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-cell-text transition-colors">{emp.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={!inputName.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] mt-2"
              >
                登録して始める
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
