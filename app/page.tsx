"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../src/lib/supabaseClient";
import { Camera, QrCode, X, RefreshCw, AlertTriangle, HelpCircle, Clock, FileText, ArrowDown, ArrowUp, Image as ImageIcon, Upload, Heart } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import QRCode from "react-qr-code";
import confetti from "canvas-confetti";
import { useTheme } from "../src/components/ThemeProvider";
import { DndContext, useSensor, useSensors, PointerSensor, TouchSensor, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
interface TalkTheme {
  id: number | string;
  content: string;
}

interface Employee {
  id: string | number;
  name?: string;
  furigana?: string;
  self_introduction?: string;
  is_rare?: boolean;
  is_absent?: boolean;
  equipped_title?: string;
  is_favorite?: boolean;
  [key: string]: any;
}

export interface Achievement {
  code: string;
  name: string;
  description: string;
  category: string;
}

interface BingoDraw {
  id: string;
  drawn_employee_id: string;
  drawn_at: string;
}

interface BingoCard {
  id: string;
  player_name: string;
  cell_index: number;
  employee_id: string;
  created_at: string;
}

type CellData =
  | { id: string; type: "free"; isOpen: boolean; openedAt?: string }
  | { id: string; type: "empty"; isOpen: boolean; openedAt?: string }
  | { id: string; type: "employee"; employee: Employee; isOpen: boolean; placedAt?: string; talkTheme?: string; openedAt?: string };

const generatePin = (id: string | number) => {
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash) % 10000).padStart(4, '0');
};

const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const BingoCell = React.memo(function BingoCell({ index, cell, onClick, allEmployees, achievementsData, fallbackTitles, isReachTarget }: any) {
  const isDraggableDropable = index !== 12 && !cell.isOpen && cell.type !== 'free';

  const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform, isDragging } = useDraggable({
    id: `drag-${cell.id}`,
    data: { index, absoluteIndex: index, cell }, // 絶対インデックスを明示的に渡す
    disabled: !isDraggableDropable,
  });

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: cell.id,
    data: { index, absoluteIndex: index, cell }, // 絶対インデックスを明示的に渡す
    disabled: !isDraggableDropable || isDragging, // ドラッグ中はこのマスをドロップ先として判定させない（暴走防止）
  });

  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableNodeRef(node);
    setDroppableNodeRef(node);
  };

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : "none",
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 50 : 1,
    boxShadow: isOver && !isDragging ? '0 0 0 4px rgba(99, 102, 241, 0.5)' : 'none',
    touchAction: 'none',
  };

  const isOpen = cell.isOpen;

  let hasSelfIntro = false;
  if (cell.type === "employee" && cell.employee) {
    const empFromDb = allEmployees.find((e: any) => e.id === cell.employee.id);
    const introData = empFromDb ? empFromDb.self_introduction : cell.employee.self_introduction;
    if (introData) hasSelfIntro = true;
  }

  const className = `
    relative aspect-square flex flex-col items-center justify-center
    rounded-xl sm:rounded-2xl shadow-sm text-xs font-bold transition-all duration-300 ease-out
    border-2 ${index === 12 && !isOpen ? "overflow-visible" : "overflow-hidden"}
    ${index === 12 && !isOpen
      ? hasSelfIntro
        ? "btn-sunburst bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 border-2 border-yellow-200 text-white shadow-md transform scale-100 font-extrabold"
        : "btn-sunburst bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 border-2 border-yellow-200 text-white shadow-md transform scale-100 animate-flashy font-extrabold"
      : cell.type === "empty"
        ? "bg-transparent border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-400 hover:text-indigo-500 cursor-pointer"
        : isOpen
          ? (cell.type === "employee" && cell.employee.is_rare)
            ? "bg-gradient-to-br from-yellow-400 via-amber-300 to-yellow-500 border-yellow-400 text-yellow-900 shadow-[inset_0_2px_10px_rgba(255,255,255,0.5),0_0_15px_rgba(250,204,21,0.6)] scale-[0.97] animate-[pulse_2s_ease-in-out_infinite]"
            : index === 12
              ? "bg-gradient-to-br from-pink-500 to-rose-500 border-pink-600 text-white shadow-inner scale-[0.97]"
              : "bg-indigo-500 border-indigo-600 text-white shadow-inner scale-[0.97]"
          : (cell.type === "employee" && cell.employee.is_favorite)
            ? `bg-cell-favorite-bg border-cell-border text-cell-text transition-colors hover:bg-cell-favorite-hover hover:border-indigo-200 hover:scale-[1.01] active:scale-[0.97] ${isReachTarget ? 'animate-heartbeat border-pink-400 border-2 z-10' : ''}`
            : `bg-cell-bg border-cell-border text-cell-text transition-colors hover:bg-indigo-50 hover:border-indigo-200 hover:scale-[1.01] active:scale-[0.97] ${isReachTarget ? 'animate-heartbeat border-pink-400 border-2 z-10' : ''}`
    }
  `;

  let innerContent = null;
  if (cell.type === "empty") {
    innerContent = <span className="text-3xl font-light">+</span>;
  } else {
    let hasImage = false;
    let image = "";
    if (cell.type === "employee") {
      const empFromDb = allEmployees.find((e: any) => e.id === cell.employee.id);
      const introData = empFromDb ? empFromDb.self_introduction : cell.employee.self_introduction;
      if (introData) {
        try {
          const parsed = JSON.parse(introData);
          if (parsed.image) {
            image = parsed.image;
            hasImage = true;
          }
        } catch { }
      }
    }

    if (hasImage) {
      innerContent = <img src={image} className="absolute inset-0 w-full h-full object-cover" alt="Profile" />;
    } else if (index === 12 && !isOpen) {
      innerContent = (
        <span className="text-[10px] sm:text-xs leading-tight text-center px-1 drop-shadow-md relative z-10">
          タップして<br />自己紹介
        </span>
      );
    } else {
      innerContent = (
        <div className="relative z-10 flex flex-col items-center justify-center w-full">
          {cell.type === "employee" && (() => {
            const empFromDb = allEmployees.find((e: any) => e.id === cell.employee.id);
            const currentTitleCode = empFromDb ? empFromDb.equipped_title : cell.employee.equipped_title;

            if (!currentTitleCode) return null;

            const titleObj = achievementsData.find((a: any) => a.code === currentTitleCode);
            const displayTitle = titleObj ? titleObj.name : (fallbackTitles[currentTitleCode]?.name || "称号");

            return (
              <span className="text-[8px] bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-1.5 py-0.5 rounded-sm mb-0.5 whitespace-nowrap scale-90 shadow-sm border border-yellow-300">
                {displayTitle}
              </span>
            );
          })()}
          <span className="text-center leading-tight px-1 break-words w-full line-clamp-2">
            {cell.type === "employee" ? cell.employee.name || "No Name" : ""}
          </span>
        </div>
      );
    }
  }

  return (
    <motion.button
      layout={!isDragging} // ドラッグ中はレイアウトアニメーションを無効化し、dnd-kitのtransformと競合するチラつきを防止
      transition={{ layout: { type: "spring", bounce: 0.1, duration: 0.4 } }}
      ref={setNodeRef}
      style={style}
      onClick={() => onClick(index)}
      {...attributes}
      {...listeners}
      className={className}
    >
      {innerContent}
      {isOpen && index !== 12 && (
        <div className="absolute inset-0 bg-black/5 rounded-xl sm:rounded-2xl pointer-events-none"></div>
      )}
    </motion.button>
  );
});

// マスターデータ未取得時のための称号名フォールバック辞書
const fallbackTitles: Record<string, { name: string, description: string }> = {
  bingo_beginner: { name: "ビンゴビギナー", description: "初めてビンゴゲームに参加する" },
  lucky: { name: "ラッキー！", description: "初めてビンゴを達成する" },
  double_threat: { name: "ダブルスレット", description: "1回のゲームで2列同時にビンゴを達成する" },
  completer: { name: "コンプリーター", description: "カードの全マスを開ける" },
  sonic_bingo: { name: "音速のビンゴ職人", description: "最短手数でビンゴになる" },
  jirashi_master: { name: "じらしの達人", description: "リーチになってから10回以上数字が呼ばれてもビンゴにならない" },
  surechigai_god: { name: "すれ違いの神様", description: "リーチが3つ以上あるのにビンゴしない" },
  appearance_check: { name: "身だしなみチェック", description: "プロフィール画像をはじめて設定した" },
  nice_to_meet_you: { name: "はじめまして！", description: "自己紹介をはじめて設定した" },
  unwavering_will: { name: "変わらない意志", description: "自己紹介の内容を変更していないのに「確定する」ボタンを押した" },
  telepathy_hope: { name: "テレパシー希望", description: "自己紹介を15文字しか書かなかった" },
  storyteller: { name: "語り部", description: "自己紹介を100文字も書いた" },
  consider_reader: { name: "読む方の身にもなって", description: "自己紹介を1000文字も書いた" },
  destruction_creation: { name: "破壊と再生", description: "「リセット」ボタンを押した" },
  sleeping: { name: "寝落ち？", description: "「遊び方」の画面で1分間も何も操作しなかった" },
  which_is_top: { name: "どっちが上？", description: "履歴のソートボタンを10回も連続で押した" },
  paripi: { name: "パリピ", description: "画面の背景色を変えるボタンを連続で何度も切り替えた" },
  lost_lamb: { name: "迷える子羊", description: "「別のテーマにする」ボタンを連続で10回も押した" },
  hacker_wannabe: { name: "ハッカー気取り", description: "4ケタのPIN番号を何度も間違えた" },
  ssr_hunter: { name: "SSRハンター", description: "激レアキャラのマスをはじめて開けた" }
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
  const [bingoCount, setBingoCount] = useState(0);
  const [showReachAnim, setShowReachAnim] = useState(false);
  const [showBingoAnim, setShowBingoAnim] = useState(false);
  const [showRareAnim, setShowRareAnim] = useState(false);
  const [showCompleteAnim, setShowCompleteAnim] = useState(false);
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
  const { theme, reloadTheme } = useTheme();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleDragStart = (event: any) => {
    // ドラッグ開始時のインデックスを確実に取得するためのハンドラー
    const dragIndex = event.active.data.current?.absoluteIndex;
    if (dragIndex === 12) {
      // 12番はドラッグ不可
      return;
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    // data経由で絶対インデックス（0〜24）を直接取得する
    const fromIndex = active.data.current?.absoluteIndex;
    const toIndex = over.data.current?.absoluteIndex;

    // インデックスが正しく取得できない、または同じマスでのドロップなら終了
    if (fromIndex === undefined || toIndex === undefined || fromIndex === toIndex) return;
    
    // 中央の特殊マス（インデックス12）に対する操作をガード
    if (fromIndex === 12 || toIndex === 12) return;

    const fromCell = cells[fromIndex];
    const toCell = cells[toIndex];

    if (fromCell.isOpen || toCell.isOpen) return;

    // 要素の入れ替え処理 (handleSwap相当)
    setCells(prev => {
      const newCells = [...prev];
      // 絶対インデックスに基づいて確実に入れ替えを行う (prevの最新状態を参照)
      const prevFromCell = prev[fromIndex];
      const prevToCell = prev[toIndex];
      
      // DOMノードの不要な再マウントやdnd-kitの不具合（チラつきやマスの消失・複製）を防ぐため、
      // マスのid（Reactのkey）は位置に固定し、中身のデータのみをスプレッド構文で安全にクローンして入れ替える
      newCells[fromIndex] = { ...prevToCell, id: prevFromCell.id };
      newCells[toIndex] = { ...prevFromCell, id: prevToCell.id };
      
      localStorage.setItem("bingoCells", JSON.stringify(newCells));
      return newCells;
    });

    if (!isTestMode) {
      try {
        if (fromCell.type === 'employee') {
          await supabase.from("bingo_cards").upsert({
            player_name: playerName,
            cell_index: toIndex,
            employee_id: String(fromCell.employee.id)
          }, { onConflict: 'player_name, cell_index' });
        } else {
          await supabase.from("bingo_cards").delete().match({
            player_name: playerName,
            cell_index: toIndex
          });
        }

        if (toCell.type === 'employee') {
          await supabase.from("bingo_cards").upsert({
            player_name: playerName,
            cell_index: fromIndex,
            employee_id: String(toCell.employee.id)
          }, { onConflict: 'player_name, cell_index' });
        } else {
          await supabase.from("bingo_cards").delete().match({
            player_name: playerName,
            cell_index: fromIndex
          });
        }
      } catch (err) {
        console.error("ドラッグ＆ドロップ保存エラー", err);
      }
    }
  };

  // 追加された状態変数
  const [isTestMode, setIsTestMode] = useState(false);
  const [testPassword, setTestPassword] = useState("");
  const [activePlayers, setActivePlayers] = useState<string[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSelfIntroModal, setShowSelfIntroModal] = useState(false);
  const [selfIntroText, setSelfIntroText] = useState("");
  const [profileImageBase64, setProfileImageBase64] = useState<string>("");
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<{ employee: Employee, talkTheme: string, openedAt: string } | null>(null);
  const [historySortOrder, setHistorySortOrder] = useState<'desc' | 'asc'>('desc');

  // 称号システム用の状態変数
  const [achievementsData, setAchievementsData] = useState<Achievement[]>([]);
  const [myAchievements, setMyAchievements] = useState<string[]>([]);
  const unlockingRef = useRef<Set<string>>(new Set());
  const [showTitleSelectModal, setShowTitleSelectModal] = useState(false);
  const [testEquippedTitle, setTestEquippedTitle] = useState<string | null>(null);

  // 実績トリガー用のカウンター変数
  const [themeChangeCount, setThemeChangeCount] = useState(0);
  const [bgColorChangeCount, setBgColorChangeCount] = useState(0);
  const isInitialThemeMount = useRef(true);
  const [historySortCount, setHistorySortCount] = useState(0);
  const [pinMistakeCount, setPinMistakeCount] = useState(0);
  const [cellsOpenSinceReach, setCellsOpenSinceReach] = useState(0);

  const [drawQueue, setDrawQueue] = useState<string[]>([]);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startSelfieCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.error("インカメラの起動に失敗しました", err);
      alert("カメラの起動に失敗しました。権限を確認してください。");
    }
  };

  const stopSelfieCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureSelfie = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      const video = videoRef.current;
      
      const size = Math.min(video.videoWidth, video.videoHeight);
      canvas.width = 400;
      canvas.height = 400;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);
        
        const base64 = canvas.toDataURL("image/jpeg", 0.8);
        setProfileImageBase64(base64);
        stopSelfieCamera();
      }
    }
  };

  useEffect(() => {
    if (!showSelfIntroModal && isCameraActive) {
      stopSelfieCamera();
    }
  }, [showSelfIntroModal, isCameraActive]);

  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [isCameraActive]);

  useEffect(() => {
    if (drawQueue.length === 0) return;
    const nextId = drawQueue[0];
    
    // 1. まず正しい内部IDで検索
    let index = cells.findIndex(c => c.type === "employee" && String(c.employee.id) === nextId);
    
    // 2. もし見つからない場合（古いドラッグ＆ドロップバグでIDが破損している場合）は、名前でフォールバック検索する
    if (index === -1) {
      const drawnEmp = allEmployees.find(e => String(e.id) === nextId);
      if (drawnEmp) {
        index = cells.findIndex(c => c.type === "employee" && c.employee.name === drawnEmp.name);
        if (index !== -1) {
          console.warn(`Fallback search used for: ${drawnEmp.name}`);
        }
      }
    }

    if (index !== -1 && !cells[index].isOpen) {
      handleOpenCell(index);
    }
    
    setDrawQueue(prev => prev.slice(1));
  }, [drawQueue, cells, allEmployees]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showHelpModal) {
      timer = setTimeout(() => {
        unlockAchievement('sleeping');
      }, 60000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showHelpModal]);

  const unlockAchievement = async (code: string) => {
    if (isTestMode) return; // テストユーザーは称号機能を無効化
    if (!playerName) return;

    // Check if already unlocked locally or currently unlocking
    if (myAchievements.includes(code) || unlockingRef.current.has(code)) return;

    // 即座にロックして2重発動を防ぐ
    unlockingRef.current.add(code);

    try {
      const achievement = achievementsData.find(a => a.code === code);
      const titleName = achievement ? achievement.name : (fallbackTitles[code]?.name || code);

      const { error } = await supabase.from('employee_achievements').insert([{
        employee_name: playerName,
        achievement_code: code,
        unlocked_at: new Date().toISOString()
      }]);

      if (!error) {
        setMyAchievements(prev => [...prev, code]);

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500'],
          zIndex: 9999
        });

        alert(`🎉 実績解除：【${titleName}】を獲得しました！`);
      } else {
        console.error('Achievement unlock insert error:', error);
        alert(`実績の保存に失敗しました: ${error.message || JSON.stringify(error)}`);
      }
    } catch (e: any) {
      console.error('Achievement unlock failed', e);
      alert(`実績の保存中にエラーが発生しました: ${e.message || e}`);
    }
  };

  const handleResetData = async () => {
    if (hasResetOnce && !isTestMode) return;

    if (!isTestMode) {
      localStorage.setItem("hasResetOnce", "true");
      setHasResetOnce(true);
    }

    const name = playerName || localStorage.getItem("playerName");
    if (name) {
      await supabase.from('bingo_logs').insert([{
        player_id: name,
        player_name: name,
        event_type: 'reset'
      }]);

      if (isTestMode || name.startsWith("TEST")) {
        // テストユーザーの場合は、これまでの進行状況（めくったマスなどのログ）をすべて削除してランキングもリセットする
        await supabase
          .from('bingo_logs')
          .delete()
          .eq('player_name', name)
          .in('event_type', ['open', 'reach', 'bingo']);

        // 称号データも全消去
        await supabase
          .from('employee_achievements')
          .delete()
          .eq('employee_name', name);
      }

      // リセットしたプレイヤーをactivePlayersから除外し、再登録可能にする
      setActivePlayers(prev => prev.filter(p => p !== name));

      // 自己紹介文もリセットする
      await supabase
        .from('employees')
        .update({ self_introduction: null })
        .eq('name', name);

      unlockAchievement('destruction_creation');
    }
    localStorage.removeItem("playerName");
    localStorage.removeItem("bingoCells");
    reloadTheme();
    setPlayerName("");
    setCells([]);
    setInputName("");
    setSelectedFavoriteEmployees([]);
    setSelfIntroText("");
    setProfileImageBase64("");
    setIsBingo(false);
    setIsReach(false);
    setBingoCount(0);
    localStorage.removeItem("isReach");
    localStorage.removeItem("bingoCount");
    localStorage.removeItem("testEquippedTitle");
    setIsTestMode(false);
    setTestEquippedTitle(null);
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
    const fetchAchievementsData = async () => {
      const { data } = await supabase.from('achievements').select('*');
      if (data) {
        setAchievementsData(data);
      }
    };
    fetchAchievementsData();
  }, []);

  useEffect(() => {
    const storedName = localStorage.getItem("playerName");
    const storedCells = localStorage.getItem("bingoCells");
    const resetFlag = localStorage.getItem("hasResetOnce");
    const storedBingoCount = localStorage.getItem("bingoCount");
    const storedIsReach = localStorage.getItem("isReach");
    const storedTestTitle = localStorage.getItem("testEquippedTitle");

    if (storedTestTitle) {
      setTestEquippedTitle(storedTestTitle);
    }

    if (resetFlag === "true") {
      setHasResetOnce(true);
    }

    if (storedBingoCount) {
      setBingoCount(parseInt(storedBingoCount, 10));
      setIsBingo(parseInt(storedBingoCount, 10) > 0);
    }

    if (storedIsReach === "true") {
      setIsReach(true);
    }

    if (storedName) {
      setPlayerName(storedName);
      setInputName(storedName); // すでに名前があれば入力欄の初期値にする
      if (storedName.startsWith("TEST")) {
        setIsTestMode(true);
      }
      checkResetStatus(storedName);
    }

    if (storedCells) {
      try {
        const parsedCells = JSON.parse(storedCells);
        if (Array.isArray(parsedCells) && parsedCells.length === 25) {
          const patchedCells = parsedCells.map((c: any, i: number) => c.id ? c : { ...c, id: crypto.randomUUID() });
          setCells(patchedCells);
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

    const fetchMyAchievements = async () => {
      const { data } = await supabase
        .from('employee_achievements')
        .select('achievement_code')
        .eq('employee_name', playerName);
      if (data) {
        const codes = data.map(d => d.achievement_code);
        setMyAchievements(codes);
        unlockingRef.current = new Set(codes);
      }
    };
    fetchMyAchievements();

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

  // テーマ変更の監視（パリピ称号用）
  useEffect(() => {
    if (isInitialThemeMount.current) {
      isInitialThemeMount.current = false;
      return;
    }

    setBgColorChangeCount(prev => {
      const next = prev + 1;
      if (next === 10) unlockAchievement('paripi');
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const sendLog = async (eventType: 'open' | 'reach' | 'bingo' | 'complete', targetEmployeeId?: string | number) => {
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

        const [empResponse, themeResponse, logsResponse, achResponse, drawsResponse] = await Promise.all([
          supabase.from("employees").select("*"),
          supabase.from("talk_themes").select("*"),
          supabase.from("bingo_logs").select("player_name, event_type, created_at").in("event_type", ["start", "reset"]),
          supabase.from("achievements").select("*"),
          supabase.from("bingo_draws").select("drawn_employee_id")
        ]);

        if (achResponse.data) {
          setAchievementsData(achResponse.data);
        }

        if (empResponse.error) {
          console.error("社員データの取得に失敗しました:", empResponse.error);
          return;
        }

        if (themeResponse.data) {
          setTalkThemes(themeResponse.data);
        }

        if (logsResponse.data) {
          const playerStatus: Record<string, { type: string, time: number }> = {};
          logsResponse.data.forEach(log => {
            const time = new Date(log.created_at).getTime();
            if (!playerStatus[log.player_name] || playerStatus[log.player_name].time < time) {
              playerStatus[log.player_name] = { type: log.event_type, time };
            }
          });
          const actives = Object.entries(playerStatus)
            .filter(([_, status]) => status.type === 'start')
            .map(([name, _]) => name);
          setActivePlayers(actives);
        }

        const data = empResponse.data;

        if (data) {
          const sortedData = [...data].sort((a, b) => {
            const nameA = a.name || "";
            const nameB = b.name || "";
            return nameA.localeCompare(nameB, 'ja');
          });
          setAllEmployees(sortedData);

          // 過去のドラッグ＆ドロップバグによるデータの不整合（名前とIDのズレ）を自己修復する
          setCells(prev => {
            let hasCorruptedData = false;
            const healedCells = prev.map(c => {
              if (c.type === "employee" && c.employee && c.employee.name) {
                const correctEmp = sortedData.find(e => e.name === c.employee.name);
                if (correctEmp && String(correctEmp.id) !== String(c.employee.id)) {
                  console.warn(`Data corruption detected and healed for: ${c.employee.name}`);
                  hasCorruptedData = true;
                  return { ...c, employee: { ...c.employee, id: correctEmp.id } };
                }
              }
              return c;
            });
            if (hasCorruptedData) {
              localStorage.setItem("bingoCells", JSON.stringify(healedCells));
              return healedCells;
            }
            return prev;
          });
        }

        if (drawsResponse.data) {
          const drawnIds = drawsResponse.data.map(d => String(d.drawn_employee_id));
          setCells(prev => {
            let updated = false;
            const newCells = prev.map((c, idx) => {
              if (idx !== 12 && c.type === "employee" && !c.isOpen && drawnIds.includes(String(c.employee.id))) {
                updated = true;
                return { ...c, isOpen: true, openedAt: new Date().toISOString() };
              }
              return c;
            });
            if (updated) {
              localStorage.setItem("bingoCells", JSON.stringify(newCells));
              return newCells;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("予期せぬエラーが発生しました:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployees();

    const channel = supabase
      .channel('employees_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'employees' },
        (payload) => {
          setAllEmployees((prev) =>
            prev.map(emp => emp.id === payload.new.id ? { ...emp, ...payload.new } : emp)
          );
          setCells((prev) => {
            const newCells = prev.map(cell => {
              if (cell.type === "employee" && cell.employee.id === payload.new.id) {
                return { ...cell, employee: { ...cell.employee, ...payload.new } };
              }
              return cell;
            });
            localStorage.setItem("bingoCells", JSON.stringify(newCells));
            return newCells;
          });
        }
      )
      .subscribe();

    const logsChannel = supabase
      .channel('bingo_logs_active_players')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bingo_logs' },
        (payload) => {
          if (payload.new.event_type === 'start') {
            setActivePlayers((prev) => Array.from(new Set([...prev, payload.new.player_name])));
          } else if (payload.new.event_type === 'reset') {
            setActivePlayers((prev) => prev.filter(name => name !== payload.new.player_name));
          }
        }
      )
      .subscribe();

    const drawsChannel = supabase
      .channel('bingo_draws_active_players')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bingo_draws' },
        (payload) => {
          setDrawQueue(prev => [...prev, String(payload.new.drawn_employee_id)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(drawsChannel);
    };
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
    let currentBingoCount = 0;
    let reachCount = 0;

    for (const line of lines) {
      const openCount = line.filter((index) => cells[index]?.isOpen).length;
      if (openCount === 5) {
        hasBingo = true;
        currentBingoCount++;
      } else if (openCount === 4) {
        hasReach = true;
        reachCount++;
      }
    }

    if (reachCount >= 3 && currentBingoCount === 0) {
      unlockAchievement('surechigai_god');
    }

    if (currentBingoCount > bingoCount) {
      if (showRareAnim) return;
      const increaseAmount = currentBingoCount - bingoCount;
      setBingoCount(currentBingoCount);
      localStorage.setItem("bingoCount", currentBingoCount.toString());
      setIsBingo(true);
      setShowBingoAnim(true);

      // 初勝利・ダブルビンゴ・コンプリーター・神速のビンゴの実績判定
      if (bingoCount === 0) {
        unlockAchievement('lucky');
        const openedCount = cells.filter(c => c.isOpen).length;
        if (openedCount <= 5) {
          unlockAchievement('sonic_bingo');
        }
      }
      if (increaseAmount >= 2) {
        unlockAchievement('double_threat');
      }

      if (currentBingoCount === 12 && bingoCount < 12) {
        unlockAchievement('completer');
        setTimeout(() => {
          setShowCompleteAnim(true);
          setTimeout(() => setShowCompleteAnim(false), 8000);
        }, 5000);
        // 最後のビンゴログ送信からさらに1秒遅らせてコンプリートのログを送る
        setTimeout(() => sendLog('complete'), 1000 + (increaseAmount * 100) + 1000);
      }

      for (let i = 0; i < increaseAmount; i++) {
        setTimeout(() => sendLog('bingo'), 1000 + i * 100);
      }

      if (currentBingoCount === 1) {
        confetti({
          particleCount: 400,
          spread: 160,
          startVelocity: 50,
          origin: { y: 0.3 },
          zIndex: 9999,
          colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
        });
      } else if (currentBingoCount === 2) {
        const duration = 3000;
        const end = Date.now() + duration;
        const frame = () => {
          confetti({
            particleCount: 7,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.8 },
            colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
            zIndex: 9999
          });
          confetti({
            particleCount: 7,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.8 },
            colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
            zIndex: 9999
          });
          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();
      } else {
        const duration = 5000;
        const end = Date.now() + duration;
        const frame = () => {
          confetti({
            particleCount: 15,
            startVelocity: 40,
            spread: 360,
            origin: { x: Math.random(), y: Math.random() - 0.2 },
            colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'],
            zIndex: 9999
          });
          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();
      }

      setTimeout(() => setShowBingoAnim(false), 5000);
    } else if (hasReach && !hasBingo && !isReach) {
      if (showRareAnim) return;
      setIsReach(true);
      localStorage.setItem("isReach", "true");
      setShowReachAnim(true);
      setTimeout(() => sendLog('reach'), 1000);
      setTimeout(() => setShowReachAnim(false), 3000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, isReach, bingoCount, showRareAnim, playerName]);

  const handleCellClickRef = useRef<any>(null);
  useEffect(() => {
    handleCellClickRef.current = handleCellClick;
  });
  
  const stableOnClick = useCallback((index: number) => {
    if (handleCellClickRef.current) {
      handleCellClickRef.current(index);
    }
  }, []);

  const handleCellClick = (index: number) => {
    const cell = cells[index];

    if (index === 12) {
      const selfEmp = allEmployees.find(emp => emp.name === playerName);

      setSelfIntroText("");
      setProfileImageBase64("");

      if (selfEmp && selfEmp.self_introduction) {
        try {
          const parsed = JSON.parse(selfEmp.self_introduction);
          if (parsed.text) setSelfIntroText(parsed.text);
          if (parsed.image) setProfileImageBase64(parsed.image);
        } catch {
          setSelfIntroText(selfEmp.self_introduction);
        }
      }
      setShowSelfIntroModal(true);
      return;
    }

    if (cell.type === "free") return;

    if (cell.type === "employee") {
      setSelectedHistoryItem({
        employee: cell.employee,
        talkTheme: cell.talkTheme || "",
        openedAt: cell.placedAt || new Date().toISOString()
      });
      setShowHistoryModal(true);
      return;
    }

    if (cells[12] && (!('isOpen' in cells[12]) || !cells[12].isOpen)) {
      alert("まずは中央のマスをタップして自己紹介を作成してください！");
      return;
    }

    if (cell.type === "empty") {
      setSelectedCellIndex(index);
      setIsScannerOpen(false);
      setIsShowMyQr(false);
      setInputPin("");
      setPinError("");
      if (talkThemes.length > 0) {
        const randomTheme = talkThemes[Math.floor(Math.random() * talkThemes.length)];
        setCurrentTalkTheme(randomTheme);
      }
    }
  };

  const handlePlaceEmployee = async (index: number, employee: Employee) => {
    const now = new Date().toISOString();
    setCells(prev => {
      const newCells = [...prev];
      newCells[index] = { 
        id: prev[index].id,
        type: "employee", 
        employee, 
        isOpen: false,
        placedAt: now,
        talkTheme: currentTalkTheme?.content || undefined
      };
      localStorage.setItem("bingoCells", JSON.stringify(newCells));
      return newCells;
    });

    if (!isTestMode) {
      try {
        await supabase.from("bingo_cards").upsert({
          player_name: playerName,
          cell_index: index,
          employee_id: String(employee.id)
        }, { onConflict: 'player_name, cell_index' });
      } catch (err) {
        console.error("カード配置保存エラー", err);
      }
    }
  };

  const handleOpenCell = async (index: number | null) => {
    if (index === null) return;
    const cell = cells[index];
    if (cell.isOpen) return;

    // じらしの達人の実績判定
    if (isReach && bingoCount === 0) {
      setCellsOpenSinceReach(prev => {
        const next = prev + 1;
        if (next >= 10) unlockAchievement('jirashi_master');
        return next;
      });
    }

    const now = new Date().toISOString();
    setCells(prevCells => {
      const newCells = prevCells.map((c, i) =>
        i === index ? { ...c, isOpen: true } : c
      );
      localStorage.setItem("bingoCells", JSON.stringify(newCells));
      return newCells;
    });

    if (cell && cell.type === "employee" && index !== 12) {
      // 念のため、ローカルのIDが破損している場合に備えて正しいIDを検索して送信する
      let correctId = cell.employee.id;
      if (allEmployees && allEmployees.length > 0) {
        const correctEmp = allEmployees.find(e => e.name === cell.employee.name);
        if (correctEmp) {
          correctId = correctEmp.id;
        }
      }
      sendLog('open', correctId);
    }

    if (cell && cell.type === "employee" && cell.employee.is_rare) {
      unlockAchievement('ssr_hunter');
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
    } else if (cell && cell.type === "employee" && cell.employee.is_favorite) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#ff69b4', '#ff1493', '#ffc0cb'],
        zIndex: 9999
      });
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
          (errorMessage) => { }
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
    if (cell.type === "empty") {
      const scannedEmp = allEmployees.find(emp => String(emp.id) === decodedText);
      if (scannedEmp) {
        const isPlaced = cells.some(c => c.type === "employee" && String(c.employee.id) === String(scannedEmp.id));
        if (isPlaced) {
          alert("この社員はすでに配置されています");
          return;
        }
        await stopScanner();
        await handlePlaceEmployee(selectedCellIndex, scannedEmp);
        setSelectedCellIndex(null);
        setIsShowMyQr(false);
      } else {
        console.log("社員データが見つかりません");
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

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTestMode) {
      if (testPassword !== "9999") {
        alert("パスワードが違います");
        return;
      }
      let randomId = Math.floor(1000 + Math.random() * 9000);
      while (activePlayers.includes(`TEST-${randomId}`)) {
        randomId = Math.floor(1000 + Math.random() * 9000);
      }
      let testName = `TEST-${randomId}`;
      localStorage.setItem("playerName", testName);
      setPlayerName(testName);
      reloadTheme();

      // 初心者称号の実績解除
      setTimeout(() => {
        unlockAchievement('bingo_beginner');
      }, 1000);

      const newCells: CellData[] = [];
      for (let i = 0; i < 25; i++) {
        const cellId = crypto.randomUUID();
        if (i === 12) {
          newCells.push({
            id: cellId,
            type: "employee",
            employee: { id: "test", name: testName },
            isOpen: true,
          });
        } else {
          newCells.push({ id: cellId, type: "empty", isOpen: false });
        }
      }

      const favorites = allEmployees.filter(
        emp => selectedFavoriteEmployees.includes(String(emp.id))
      ).map(emp => ({ ...emp, is_favorite: true }));

      const emptyIndices = [0,1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23,24].sort(() => 0.5 - Math.random());
      const shuffledFavorites = [...favorites].sort(() => 0.5 - Math.random());
      const now = new Date().toISOString();

      shuffledFavorites.forEach(fav => {
        const index = emptyIndices.pop();
        if (index !== undefined) {
          newCells[index] = {
            id: newCells[index].id,
            isOpen: newCells[index].isOpen,
            type: "employee",
            employee: fav,
            placedAt: now,
          };
        }
      });

      setCells(newCells);
      localStorage.setItem("bingoCells", JSON.stringify(newCells));
      setShowNameModal(false);
      return;
    }

    if (inputName.trim()) {
      if (activePlayers.includes(inputName.trim())) {
        alert("このプレイヤーはすでにログインしています。");
        return;
      }
      localStorage.setItem("playerName", inputName.trim());
      setPlayerName(inputName.trim());
      reloadTheme();
      checkResetStatus(inputName.trim());

      // 初心者称号の実績解除
      setTimeout(() => {
        unlockAchievement('bingo_beginner');
      }, 1000);

      await supabase.from("bingo_logs").insert([{
        player_id: inputName.trim(),
        player_name: inputName.trim(),
        event_type: 'start',
      }]);

      const remainingEmployees = allEmployees.filter(
        emp => !selectedFavoriteEmployees.includes(String(emp.id)) && emp.name !== inputName.trim()
      );

      const favorites = allEmployees.filter(
        emp => selectedFavoriteEmployees.includes(String(emp.id)) && emp.name !== inputName.trim()
      ).map(emp => ({ ...emp, is_favorite: true }));

      const newCells: CellData[] = [];
      const selfEmp = allEmployees.find(emp => emp.name === inputName.trim()) || { id: "self", name: inputName.trim() };

      for (let i = 0; i < 25; i++) {
        const cellId = crypto.randomUUID();
        if (i === 12) {
          newCells.push({ id: cellId, type: "employee", employee: selfEmp, isOpen: false });
        } else {
          newCells.push({ id: cellId, type: "empty", isOpen: false });
        }
      }

      const emptyIndices = [0,1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23,24].sort(() => 0.5 - Math.random());
      
      const shuffledFavorites = [...favorites].sort(() => 0.5 - Math.random());
      const now = new Date().toISOString();
      const insertPromises: any[] = [];

      shuffledFavorites.forEach(fav => {
        const index = emptyIndices.pop();
        if (index !== undefined) {
          newCells[index] = {
            id: newCells[index].id,
            isOpen: newCells[index].isOpen,
            type: "employee",
            employee: fav,
            placedAt: now,
          };
          if (!isTestMode) {
            insertPromises.push(
              supabase.from("bingo_cards").upsert({
                player_name: inputName.trim(),
                cell_index: index,
                employee_id: String(fav.id)
              }, { onConflict: 'player_name, cell_index' })
            );
          }
        }
      });

      setCells(newCells);
      localStorage.setItem("bingoCells", JSON.stringify(newCells));
      setShowNameModal(false);

      if (insertPromises.length > 0) {
        Promise.all(insertPromises).catch(err => console.error("お気に入り社員の初期配置保存エラー", err));
      }
    }
  };

  const handleSelfIntroSubmit = async () => {
    if (!isTestMode && selfIntroText.length < 15) {
      alert("自己紹介は15文字以上で入力してください。");
      return;
    }

    const payload = JSON.stringify({ text: selfIntroText, image: profileImageBase64 });

    if (!isTestMode) {
      const selfEmp = allEmployees.find(emp => emp.name === playerName);
      if (selfEmp && (typeof selfEmp.id !== "string" || (typeof selfEmp.id === "string" && !selfEmp.id.startsWith("dummy")))) {
        await supabase.from("employees").update({ self_introduction: payload }).eq("id", selfEmp.id);

        // ローカルステートも更新
        setAllEmployees(prev => prev.map(emp =>
          emp.id === selfEmp.id ? { ...emp, self_introduction: payload } : emp
        ));
      }

      // 実績の判定
      if (selfEmp && !selfEmp.self_introduction) {
        unlockAchievement('nice_to_meet_you');
      } else if (selfEmp && selfEmp.self_introduction === payload) {
        unlockAchievement('unwavering_will');
      }

      if (profileImageBase64) {
        unlockAchievement('appearance_check');
      }

      const textLength = selfIntroText.length;
      if (textLength === 15) {
        unlockAchievement('telepathy_hope');
      }
      if (textLength >= 100 && textLength < 1000) {
        unlockAchievement('storyteller');
      }
      if (textLength >= 1000) {
        unlockAchievement('consider_reader');
      }
    }

    // テストモードを含め、セルのローカルステートは更新する
    setCells(prevCells => {
      const newCells = [...prevCells];
      if (newCells[12] && newCells[12].type === "employee") {
        newCells[12] = {
          ...newCells[12],
          employee: { ...newCells[12].employee, self_introduction: payload }
        };
      }
      return newCells;
    });

    handleOpenCell(12);
    setShowSelfIntroModal(false);
  };

  const reachCellIndices = new Set<number>();
  if (cells.length === 25) {
    const lines = [
      [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24], // rows
      [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24], // cols
      [0, 6, 12, 18, 24], [4, 8, 12, 16, 20] // diagonals
    ];
    for (const line of lines) {
      const openCells = line.filter(idx => cells[idx]?.isOpen);
      if (openCells.length === 4) {
        const unopenedIndex = line.find(idx => !cells[idx]?.isOpen);
        if (unopenedIndex !== undefined) {
          reachCellIndices.add(unopenedIndex);
        }
      }
    }
  }

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
          <p className="text-slate-800 transition-colors text-sm mt-3 font-medium bg-white/50 inline-block px-4 py-1.5 rounded-full shadow-sm">
            社員BINGOで楽しく交流しよう！
          </p>
        </div>

        {/* ビンゴボードエリア */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="bg-card-bg transition-colors p-3 sm:p-5 rounded-3xl shadow-xl border border-gray-100/80">
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {cells.map((cell, index) => (
                <BingoCell
                  key={cell.id}
                  index={index}
                  cell={cell}
                  onClick={stableOnClick}
                  allEmployees={allEmployees}
                  achievementsData={achievementsData}
                  fallbackTitles={fallbackTitles}
                  isReachTarget={reachCellIndices.has(index)}
                />
              ))}
            </div>
          </div>
        </DndContext>

        {/* 配置の進行状況表示 */}
        <div className="mt-6 text-center w-full max-w-md mx-auto px-2">
          {(() => {
            const placedCount = cells.filter(c => c.type === "employee").length;
            if (placedCount < 25) {
              return (
                <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-indigo-100">
                  <p className="text-sm font-bold text-indigo-800">
                    空きマスをタップして社員を配置しよう！ ( {Math.max(0, placedCount - 1)} / 24 )
                  </p>
                </div>
              );
            } else {
              return (
                <div className="bg-indigo-50 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-indigo-200 animate-pulse">
                  <p className="text-sm font-bold text-indigo-700">
                    🎉 カードが完成しました！幹事の抽選をお待ちください。
                  </p>
                </div>
              );
            }
          })()}
        </div>

        {/* フッターアクション（スマホ向けレスポンシブ配置） */}
        <div className="mt-8 flex flex-col items-center gap-6 pb-8 w-full max-w-md mx-auto px-2">
          {/* 上段：マイQR */}
          <div className="flex justify-center w-full">
            {!isTestMode ? (
              <button
                onClick={() => setIsShowMyQr(true)}
                className="flex flex-col items-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors relative z-10"
              >
                <div className="bg-white border-2 border-indigo-200 p-4 rounded-3xl shadow-md active:scale-95 transition-transform">
                  <QrCode size={28} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold tracking-wide text-indigo-600">マイQR</span>
              </button>
            ) : (
              <div className="h-[88px]"></div>
            )}
          </div>

          {/* 下段：履歴、遊び方、リセット */}
          <div className="flex justify-between items-end w-full px-4">
            {/* 左：履歴 */}
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex flex-col items-center gap-1.5 text-indigo-500 hover:text-indigo-700 transition-colors flex-1"
            >
              <div className="bg-white border border-indigo-100 p-3 rounded-2xl shadow-sm active:scale-95 transition-transform">
                <Clock size={22} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-bold tracking-wide">履歴</span>
            </button>

            {/* 中央：遊び方 */}
            <button
              onClick={() => {
                setShowHelpModal(true);
              }}
              className="flex flex-col items-center gap-1.5 text-indigo-500 hover:text-indigo-700 transition-colors flex-1"
            >
              <div className="bg-white border border-indigo-100 p-3 rounded-2xl shadow-sm active:scale-95 transition-transform">
                <HelpCircle size={22} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-bold tracking-wide">遊び方</span>
            </button>

            {/* 右：リセット */}
            <button
              onClick={() => (!hasResetOnce || isTestMode) && setShowResetConfirm(true)}
              disabled={hasResetOnce && !isTestMode}
              className={`flex flex-col items-center gap-1.5 transition-colors flex-1 ${(hasResetOnce && !isTestMode) ? "text-gray-300 cursor-not-allowed opacity-50" : "text-red-400 hover:text-red-600"
                }`}
            >
              <div className={`border p-3 rounded-2xl shadow-sm ${(hasResetOnce && !isTestMode) ? "bg-cell-bg transition-colors border-gray-100" : "bg-white border-red-100 active:scale-95 transition-transform"
                }`}>
                <AlertTriangle size={22} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-bold tracking-wide">{(hasResetOnce && !isTestMode) ? "リセット済" : "リセット"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* モーダル */}
      {selectedCellIndex !== null && cells[selectedCellIndex] && cells[selectedCellIndex].type === "empty" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-text-main transition-colors bg-button-light transition-colors p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-2 text-center mt-2">
              <h2 className="text-2xl font-bold text-text-main transition-colors mb-1 flex items-center justify-center gap-2">
                誰に話しかける？
              </h2>
              <p className="text-sm text-text-muted transition-colors text-center">
                相手を見つけて、トークテーマで話そう！
              </p>
            </div>

            <div className="w-full bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4 mt-2">
              <p className="text-[10px] text-indigo-500 font-bold text-center mb-2 tracking-widest">TALK THEME</p>
              <p className="text-sm font-bold text-indigo-900 text-center leading-relaxed">
                {currentTalkTheme ? currentTalkTheme.content : "好きな食べ物は？"}
              </p>
            </div>

            {!isScannerOpen && (
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={() => {
                    if (talkThemes.length > 0) {
                      let nextTheme;
                      do {
                        nextTheme = talkThemes[Math.floor(Math.random() * talkThemes.length)];
                      } while (nextTheme.id === currentTalkTheme?.id && talkThemes.length > 1);
                      setCurrentTalkTheme(nextTheme);
                    }
                    setThemeChangeCount(prev => {
                      const next = prev + 1;
                      if (next === 10) unlockAchievement('lost_lamb');
                      return next;
                    });
                  }}
                  className="flex items-center justify-center gap-2 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-600 font-bold py-3 px-4 rounded-xl shadow-sm transition-all active:scale-[0.98]"
                >
                  <RefreshCw size={16} />
                  別のテーマにする
                </button>

                <button
                  onClick={startScanner}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] mt-2"
                >
                  <Camera size={20} />
                  QRを読み取って配置する
                </button>

                <div className="flex flex-col gap-2 bg-cell-bg transition-colors p-4 rounded-xl border border-gray-200 mt-2">
                  <p className="text-xs text-center text-text-muted transition-colors font-bold">または4ケタのPIN番号を入力して配置</p>
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
                        const targetEmp = allEmployees.find(emp => generatePin(emp.id) === inputPin);
                        if (targetEmp) {
                          const isPlaced = cells.some(c => c.type === "employee" && String(c.employee.id) === String(targetEmp.id));
                          if (isPlaced) {
                            setPinError("すでに配置されています");
                          } else {
                            handlePlaceEmployee(selectedCellIndex, targetEmp);
                            closeModal();
                            setPinMistakeCount(0);
                          }
                        } else {
                          setPinError("番号が違います");
                          setPinMistakeCount(prev => {
                            const next = prev + 1;
                            if (next >= 5) unlockAchievement('hacker_wannabe');
                            return next;
                          });
                        }
                      }}
                      disabled={inputPin.length !== 4}
                      className="bg-indigo-600 disabled:bg-gray-300 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold transition-colors"
                    >
                      配置する
                    </button>
                  </div>
                  {pinError && <p className="text-xs text-red-500 text-center font-bold">{pinError}</p>}
                </div>
              </div>
            )}

            {isScannerOpen && (
              <div className="w-full flex flex-col items-center mt-4">
                <div id="reader" className="w-full max-w-[250px] overflow-hidden rounded-xl bg-black mb-4"></div>
                <button
                  onClick={stopScanner}
                  className="bg-button-light transition-colors hover:bg-gray-200 text-cell-text transition-colors font-bold py-2 px-6 rounded-full transition-colors mt-2"
                >
                  カメラを閉じる
                </button>
              </div>
            )}

            {/* 開発環境用デバッグ機能 */}
            {process.env.NODE_ENV === "development" && !isScannerOpen && (
              <button
                onClick={() => {
                  const unplacedEmployees = allEmployees.filter(emp => !cells.some(c => c.type === "employee" && c.employee.id === emp.id) && emp.id !== "dummy-12" && emp.name !== playerName);
                  if (unplacedEmployees.length > 0) {
                    const targetEmp = unplacedEmployees[Math.floor(Math.random() * unplacedEmployees.length)];
                    handlePlaceEmployee(selectedCellIndex, targetEmp);
                    closeModal();
                  } else {
                    alert("配置可能な社員がいません");
                  }
                }}
                className="mt-6 text-xs text-gray-400 hover:text-text-main transition-colors underline"
              >
                [デバッグ] ランダムな社員を配置する
              </button>
            )}
          </div>
        </div>
      )}

      {/* マイQRモーダル */}
      {isShowMyQr && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setIsShowMyQr(false)}>
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
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
          <div className="text-7xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] animate-bounce scale-110 flex flex-col items-center">
            <span>BINGO!!!</span>
            {bingoCount >= 2 && (
              <span className="text-4xl sm:text-6xl mt-4 text-white drop-shadow-lg">{bingoCount}回目！</span>
            )}
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

      {/* フルコンプリート演出 */}
      {showCompleteAnim && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none bg-black/40 transition-opacity duration-1000">
          <div className="text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-300 via-purple-400 to-pink-500 drop-shadow-[0_0_30px_rgba(255,255,255,1)] animate-bounce scale-110 flex flex-col items-center">
            <span>FULL</span>
            <span>COMPLETE!!</span>
            <span className="text-2xl sm:text-4xl mt-6 text-white drop-shadow-lg font-bold">全マス制覇おめでとう！</span>
          </div>
        </div>
      )}

      {/* リセット確認モーダル */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)}>
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowHelpModal(false)}>
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setShowHelpModal(false);
              }}
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
                <p>まずは中央のマスをタップして、自己紹介文を登録しよう！</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-indigo-500 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">2</span>
                <p>マスに書かれた名前の社員に声をかけよう！</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-indigo-500 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">3</span>
                <p>マスをタップするとお題が出るので、そのトークテーマについて話します。</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-indigo-500 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">4</span>
                <p>話が終わったら、相手に「マイQR」を見せてもらい、自分のカメラで読み取ります。</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-indigo-500 bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">5</span>
                <p>QRが一致するとマスが開きます！縦・横・斜めのどれか一列揃うとBINGOです！</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowHelpModal(false);
              }}
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
          <div className="absolute bottom-4 left-4 z-10">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white/30 hover:text-white/80 transition-colors">
              <input type="checkbox" checked={isTestMode} onChange={(e) => setIsTestMode(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 bg-white/10 border-white/20" />
              テストユーザーモード
            </label>
          </div>
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col items-center max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-text-main transition-colors mb-4">プレイヤー名を登録</h2>
            <p className="text-sm text-text-muted transition-colors mb-4 text-center">
              ビンゴに参加するための<br />あなたの名前を入力してください。
            </p>
            <form onSubmit={handleNameSubmit} className="w-full flex flex-col gap-4">
              {isTestMode ? (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-cell-text transition-colors">パスワード</label>
                  <input
                    type="password"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    placeholder="パスワードを入力"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-cell-text transition-colors">あなたの名前</label>
                  <select
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    autoFocus
                  >
                    <option value="" disabled>名前を選択してください</option>
                    {allEmployees
                      .filter(emp => !emp.is_absent)
                      .sort((a, b) => (a.furigana || "").localeCompare(b.furigana || "", 'ja'))
                      .map((emp) => {
                        const isActive = emp.name ? activePlayers.includes(emp.name) : false;
                        return (
                          <option
                            key={emp.id}
                            value={emp.name || ""}
                            disabled={isActive}
                          >
                            {emp.name}{isActive ? " (ログイン中)" : ""}
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-cell-text transition-colors">
                    お気に入り社員（最大{isTestMode ? 24 : 15}名まで: 現在 {selectedFavoriteEmployees.length}名）
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const maxCount = isTestMode ? 24 : 15;
                      const availableEmps = allEmployees.filter(emp => {
                        if (emp.is_rare) return false;
                        return !isTestMode ? emp.name !== inputName && !emp.is_absent : true;
                      });
                      const shuffled = [...availableEmps].sort(() => 0.5 - Math.random());
                      const selected = shuffled.slice(0, maxCount).map(emp => String(emp.id));
                      setSelectedFavoriteEmployees(selected);
                    }}
                    className="text-[10px] font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-2 py-1 rounded transition-colors"
                  >
                    ランダム選択
                  </button>
                </div>
                <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto p-2 bg-cell-bg transition-colors flex flex-col gap-2">
                  {allEmployees
                    .filter((emp) => {
                      if (emp.is_rare) return false;
                      return !isTestMode ? emp.name !== inputName && !emp.is_absent : true;
                    })
                    .sort((a, b) => (a.furigana || "").localeCompare(b.furigana || "", 'ja'))
                    .map((emp) => {
                      const isSelected = selectedFavoriteEmployees.includes(String(emp.id));
                      const isDisabled = !isSelected && selectedFavoriteEmployees.length >= (isTestMode ? 24 : 15);
                      return (
                        <label
                          key={emp.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-button-light border border-cell-border shadow-sm' : 'hover:bg-button-light transition-colors border border-transparent'
                            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            disabled={isDisabled}
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (selectedFavoriteEmployees.length < (isTestMode ? 24 : 15)) {
                                  setSelectedFavoriteEmployees([...selectedFavoriteEmployees, String(emp.id)]);
                                }
                              } else {
                                setSelectedFavoriteEmployees(selectedFavoriteEmployees.filter(id => id !== String(emp.id)));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 shrink-0"
                          />
                          <span className={`text-sm transition-colors ${isSelected ? 'text-text-main font-bold' : 'text-cell-text font-medium'}`}>
                            {emp.name} {emp.furigana && <span className={`text-xs transition-colors ml-1 ${isSelected ? 'text-text-muted font-medium' : 'text-text-muted'}`}>({emp.furigana})</span>}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isTestMode ? !testPassword : !inputName.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] mt-2"
              >
                登録して始める
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 自己紹介入力モーダル */}
      {showSelfIntroModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowSelfIntroModal(false)}>
          <div className="bg-card-bg transition-colors w-full max-w-md rounded-3xl p-6 shadow-2xl relative flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowSelfIntroModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-text-main transition-colors bg-button-light transition-colors p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-text-main transition-colors mb-2 flex items-center gap-2">
              <FileText className="text-indigo-500" />
              自己紹介を作成
            </h2>
            <p className="text-sm text-text-muted transition-colors mb-4">
              ビンゴに参加するため、あなたの自己紹介を15文字以上で入力してください。後から編集も可能です。
            </p>
            <div className="w-full flex flex-col items-center mb-4">
              {isCameraActive ? (
                <div className="relative w-48 h-48 mb-2 rounded-2xl overflow-hidden bg-black flex flex-col items-center justify-center shadow-inner">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  <button
                    onClick={captureSelfie}
                    className="absolute bottom-4 bg-white text-indigo-600 font-bold py-2 px-6 rounded-full shadow-lg hover:bg-gray-100 transition-colors active:scale-95 flex items-center gap-2"
                  >
                    <Camera size={16} />
                    撮影する
                  </button>
                  <button
                    onClick={stopSelfieCamera}
                    className="absolute top-2 right-2 text-white bg-black/50 p-1.5 rounded-full hover:bg-black/70 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div 
                  className="relative w-24 h-24 mb-2 rounded-full border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50 flex items-center justify-center overflow-hidden transition-colors group cursor-pointer"
                  onClick={profileImageBase64 ? undefined : startSelfieCamera}
                >
                  {profileImageBase64 ? (
                    <img src={profileImageBase64} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="text-indigo-300 group-hover:text-indigo-500 transition-colors" size={32} />
                  )}
                  {!profileImageBase64 && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="text-white mb-1" size={20} />
                      <span className="text-[10px] text-white font-bold">写真を撮る</span>
                    </div>
                  )}
                </div>
              )}
              {profileImageBase64 && !isCameraActive && (
                <div className="flex gap-4 mt-1">
                  <button
                    onClick={() => {
                      setProfileImageBase64("");
                      startSelfieCamera();
                    }}
                    className="text-[11px] text-indigo-500 hover:underline font-bold"
                  >
                    撮り直す
                  </button>
                  <button
                    onClick={() => setProfileImageBase64("")}
                    className="text-[11px] text-red-500 hover:underline font-bold"
                  >
                    画像を削除
                  </button>
                </div>
              )}
            </div>

            {/* 称号選択UI (テストユーザーは非表示) */}
            {!isTestMode && (
              <div className="w-full mb-4">
                <button
                  onClick={() => setShowTitleSelectModal(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-500">称号</span>
                    <span className="font-bold text-indigo-900">
                      {(() => {
                        const selfEmp = allEmployees.find(emp => emp.name === playerName);
                        if (!selfEmp || !selfEmp.equipped_title) return "未設定";
                        const titleInfo = fallbackTitles[selfEmp.equipped_title];
                        return titleInfo ? titleInfo.name : "未設定";
                      })()}
                    </span>
                  </div>
                  <span className="text-[10px] text-indigo-500 font-bold bg-white px-3 py-1 rounded-full border border-indigo-200">
                    変更
                  </span>
                </button>
              </div>
            )}

            <textarea
              value={selfIntroText}
              onChange={(e) => setSelfIntroText(e.target.value)}
              placeholder="趣味や最近ハマっていることなど..."
              className="w-full h-32 px-4 py-3 rounded-xl border border-gray-300 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white mb-2 resize-none"
            />
            <div className="flex justify-between items-center mb-4 text-sm font-bold">
              <span className={selfIntroText.length < 15 ? "text-red-500" : "text-green-600"}>
                {selfIntroText.length} 文字
              </span>
              {selfIntroText.length < 15 && <span className="text-red-500 text-xs">あと {15 - selfIntroText.length} 文字</span>}
            </div>
            <button
              onClick={handleSelfIntroSubmit}
              disabled={!isTestMode && selfIntroText.length < 15}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              確定する
            </button>
          </div>
        </div>
      )}

      {/* 称号選択モーダル */}
      {showTitleSelectModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowTitleSelectModal(false)}>
          <div className="bg-card-bg transition-colors w-full max-w-sm rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTitleSelectModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-text-main transition-colors bg-button-light transition-colors p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-text-main transition-colors mb-4 flex items-center gap-2">
              称号をえらぶ
            </h2>
            <div className="overflow-y-auto flex-1 flex flex-col gap-2 pr-2">
              <button
                onClick={async () => {
                  if (isTestMode) {
                    setTestEquippedTitle(null);
                    localStorage.removeItem("testEquippedTitle");
                    setCells(prev => prev.map(c =>
                      c.type === "employee" && c.employee.name === playerName
                        ? { ...c, employee: { ...c.employee, equipped_title: undefined } } : c
                    ));
                  } else {
                    const selfEmp = allEmployees.find(emp => emp.name === playerName);
                    if (selfEmp && typeof selfEmp.id === 'string' && !selfEmp.id.startsWith("dummy")) {
                      await supabase.from("employees").update({ equipped_title: null }).eq("id", selfEmp.id);
                      setAllEmployees(prev => prev.map(emp => emp.id === selfEmp.id ? { ...emp, equipped_title: undefined } : emp));

                      setCells(prev => prev.map(c =>
                        c.type === "employee" && c.employee.id === selfEmp.id
                          ? { ...c, employee: { ...c.employee, equipped_title: undefined } } : c
                      ));
                    }
                  }
                  setShowTitleSelectModal(false);
                }}
                className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors font-bold text-gray-600"
              >
                称号を外す
              </button>
              {Object.entries(fallbackTitles).map(([code, info]) => {
                const isUnlocked = myAchievements.includes(code);
                const selfEmp = allEmployees.find(emp => emp.name === playerName);
                const isEquipped = isTestMode ? testEquippedTitle === code : (selfEmp && selfEmp.equipped_title === code);

                return (
                  <button
                    key={code}
                    disabled={!isUnlocked}
                    onClick={async () => {
                      if (isTestMode) {
                        setTestEquippedTitle(code);
                        localStorage.setItem("testEquippedTitle", code);
                        setCells(prev => prev.map(c =>
                          c.type === "employee" && c.employee.name === playerName
                            ? { ...c, employee: { ...c.employee, equipped_title: code } } : c
                        ));
                      } else {
                        if (selfEmp && typeof selfEmp.id === 'string' && !selfEmp.id.startsWith("dummy")) {
                          await supabase.from("employees").update({ equipped_title: code }).eq("id", selfEmp.id);
                          setAllEmployees(prev => prev.map(emp => emp.id === selfEmp.id ? { ...emp, equipped_title: code } : emp));

                          setCells(prev => prev.map(c =>
                            c.type === "employee" && c.employee.id === selfEmp.id
                              ? { ...c, employee: { ...c.employee, equipped_title: code } } : c
                          ));
                        }
                      }
                      setShowTitleSelectModal(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors flex flex-col gap-1
                      ${!isUnlocked ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed" :
                        isEquipped ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-900">{isUnlocked ? info.name : "？？？"}</span>
                      {isEquipped && <span className="text-[10px] text-white bg-indigo-500 px-2 py-0.5 rounded-full font-bold">装備中</span>}
                    </div>
                    {isUnlocked && <span className="text-[10px] text-gray-500">{info.description}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 履歴モーダル */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm sm:items-center" onClick={() => { setShowHistoryModal(false); setSelectedHistoryItem(null); }}>
          <div className="bg-card-bg transition-colors w-full max-w-md h-[80vh] sm:h-[70vh] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative flex flex-col animate-[slide-up_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setShowHistoryModal(false);
                setSelectedHistoryItem(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-text-main transition-colors bg-button-light transition-colors p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3 pr-12">
              <h2 className="text-xl font-bold text-text-main transition-colors flex items-center gap-2">
                <Clock className="text-indigo-500" />
                トーク履歴
              </h2>
              {!selectedHistoryItem && (
                <button
                  onClick={() => {
                    setHistorySortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                    setHistorySortCount(prev => {
                      const next = prev + 1;
                      if (next === 10) unlockAchievement('which_is_top');
                      return next;
                    });
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors bg-gray-50 hover:bg-indigo-50 px-3 py-1.5 rounded-full border border-gray-200"
                >
                  {historySortOrder === 'desc' ? (
                    <>新しい順 <ArrowDown size={14} /></>
                  ) : (
                    <>古い順 <ArrowUp size={14} /></>
                  )}
                </button>
              )}
            </div>

            {selectedHistoryItem ? (
              <div className="flex-1 overflow-y-auto">
                <button
                  onClick={() => setSelectedHistoryItem(null)}
                  className="text-sm text-indigo-500 font-bold mb-4 hover:underline"
                >
                  ← 履歴一覧に戻る
                </button>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="mb-4 text-center flex flex-col items-center">
                    {(() => {
                      const latestEmp = allEmployees.find(emp => emp.id === selectedHistoryItem.employee.id);
                      const currentTitleCode = latestEmp ? latestEmp.equipped_title : selectedHistoryItem.employee.equipped_title;

                      if (!currentTitleCode) return null;

                      const displayTitle = fallbackTitles[currentTitleCode]?.name || currentTitleCode;
                      return (
                        <span className="text-[10px] bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-2 py-0.5 rounded-sm mb-1 shadow-sm border border-yellow-300 w-fit">
                          {displayTitle}
                        </span>
                      );
                    })()}
                    {selectedHistoryItem.employee.furigana && <p className="text-xs text-gray-500 font-medium mb-1">{selectedHistoryItem.employee.furigana}</p>}
                    <h3 className="text-2xl font-bold text-gray-900">{selectedHistoryItem.employee.name}</h3>
                  </div>
                  <div className="mb-6 bg-indigo-50 p-4 rounded-xl">
                    <p className="text-xs text-indigo-500 font-bold mb-1">話したテーマ</p>
                    <p className="font-medium text-indigo-900">{selectedHistoryItem.talkTheme || "テーマなし"}</p>
                    <p className="text-[10px] text-gray-400 mt-2 text-right">
                      {new Date(selectedHistoryItem.openedAt).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold mb-2">自己紹介</p>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                      {(() => {
                        const latestEmp = allEmployees.find(emp => emp.id === selectedHistoryItem.employee.id);
                        const rawText = latestEmp?.self_introduction || selectedHistoryItem.employee.self_introduction || "自己紹介はまだ登録されていません。";
                        let text = rawText;
                        let image = "";
                        try {
                          const parsed = JSON.parse(rawText);
                          if (parsed.text) text = parsed.text;
                          if (parsed.image) image = parsed.image;
                        } catch {
                          // Not JSON
                        }

                        return (
                          <div className="flex flex-col">
                            {image && (
                              <img src={image} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-white shadow-sm self-center mb-4" />
                            )}
                            <p>{text}</p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {(() => {
                  const placedCells = cells
                    .filter((c, i) => c.type === "employee" && i !== 12 && (c.placedAt || c.openedAt))
                    .sort((a: any, b: any) => {
                      const timeA = new Date(a.placedAt || a.openedAt).getTime();
                      const timeB = new Date(b.placedAt || b.openedAt).getTime();
                      return historySortOrder === 'desc' ? timeB - timeA : timeA - timeB;
                    });

                  if (placedCells.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Clock size={40} className="mb-2 opacity-50" />
                        <p className="font-medium">まだ履歴はありません</p>
                      </div>
                    );
                  }

                  return placedCells.map((cell: any, idx: number) => {
                    const date = new Date(cell.placedAt || cell.openedAt);
                    const formattedDate = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                    const realIndex = historySortOrder === 'desc' ? placedCells.length - idx : idx + 1;

                    return (
                      <button
                        key={cell.employee.id}
                        onClick={() => setSelectedHistoryItem({
                          employee: cell.employee,
                          talkTheme: cell.talkTheme || "",
                          openedAt: cell.placedAt || cell.openedAt
                        })}
                        className="flex items-center justify-between w-full bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 p-3 rounded-xl transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold shrink-0">
                            {realIndex}
                          </span>
                          <div>
                            <p className="font-bold text-gray-800">{cell.employee.name}</p>
                            <p className="text-[10px] text-gray-500 line-clamp-1">{cell.talkTheme || "テーマなし"}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 font-medium shrink-0 ml-2">
                          {formattedDate}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
