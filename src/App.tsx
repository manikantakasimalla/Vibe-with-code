import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music2, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants & Types ---
const GRID_SIZE = 20;
const CANVAS_SIZE = 400;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;
const FPS = 12;
const TICK_RATE = 1000 / FPS;

type Point = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const TRACKS = [
  { id: 1, title: "Neon Dreams - Synthwave Model X", artist: "AI Core", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: 2, title: "Cyber Grid - Deep Tech", artist: "Neural Net", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: 3, title: "Digital Horizon - Lo-Fi Bot", artist: "Ghost Protocol", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" }
];

// --- Custom Hooks ---
function useSnakeGame() {
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Point>({ x: 15, y: 5 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('neonSnakeHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isPaused, setIsPaused] = useState(false);

  const dirRef = useRef<Direction>('RIGHT');

  useEffect(() => {
    localStorage.setItem('neonSnakeHighScore', highScore.toString());
  }, [highScore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (dirRef.current !== 'DOWN') setDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (dirRef.current !== 'UP') setDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (dirRef.current !== 'RIGHT') setDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (dirRef.current !== 'LEFT') setDirection('RIGHT');
          break;
        case ' ':
          if (gameOver) {
            resetGame();
          } else {
            setIsPaused(p => !p);
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver]);

  const resetGame = useCallback(() => {
    setSnake([{ x: 10, y: 10 }]);
    setFood({ x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) });
    setDirection('RIGHT');
    dirRef.current = 'RIGHT';
    setGameOver(false);
    setScore(0);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    if (gameOver || isPaused) return;

    dirRef.current = direction;

    const moveSnake = () => {
      setSnake((prevSnake) => {
        const head = { ...prevSnake[0] };
        switch (direction) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        // Wall Collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameOver(true);
          return prevSnake;
        }

        // Self Collision
        if (prevSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
          setGameOver(true);
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Food logic
        if (head.x === food.x && head.y === food.y) {
          setScore(s => {
            const newScore = s + 10;
            if (newScore > highScore) setHighScore(newScore);
            return newScore;
          });
          
          let newFood = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
          while(newSnake.some(s => s.x === newFood.x && s.y === newFood.y)) {
              newFood = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
          }
          setFood(newFood);
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    };

    const interval = setInterval(moveSnake, TICK_RATE);
    return () => clearInterval(interval);
  }, [direction, gameOver, isPaused, food, highScore]);

  return { snake, food, gameOver, score, highScore, resetGame, isPaused };
}


// --- Main Application ---
export default function App() {
  const { snake, food, gameOver, score, highScore, resetGame, isPaused } = useSnakeGame();
  
  // Audio State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  // Canvas State for Drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('ended', handleNext);
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
           setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0);
        }
      });
    }
    const audio = audioRef.current;
    
    // Check if track changed before setting src to avoid interrupting if it's the same song starting up
    if (!audio.src.endsWith(TRACKS[currentTrackIndex].url.split('/').pop() || '')) {
       audio.src = TRACKS[currentTrackIndex].url;
    }
    
    audio.volume = isMuted ? 0 : volume;

    if (isPlaying) {
      audio.play().catch(e => {
        console.error("Autoplay blocked:", e);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }

    return () => {
      // Need to clean up cautiously so we don't break consecutive renders
    };
  }, [currentTrackIndex, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const handleNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
    setIsPlaying(true);
  };

  // Render Game Frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear board with super dark tone
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw Subtle Grid
    ctx.strokeStyle = '#181818';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CANVAS_SIZE; i += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, CANVAS_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(CANVAS_SIZE, i);
        ctx.stroke();
    }

    // Draw food
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff00ff';
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.arc(
      (food.x * CELL_SIZE) + (CELL_SIZE / 2), 
      (food.y * CELL_SIZE) + (CELL_SIZE / 2), 
      (CELL_SIZE / 2) - 2, 
      0, 
      2 * Math.PI
    );
    ctx.fill();

    // Draw snake
    snake.forEach((segment, index) => {
      if (index === 0) {
        ctx.fillStyle = '#ffffff'; 
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
      } else {
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
      }
      // Inner glowing segment
      ctx.fillRect((segment.x * CELL_SIZE) + 1, (segment.y * CELL_SIZE) + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });
    
    // Reset shadow
    ctx.shadowBlur = 0;

  }, [snake, food]);

  return (
    <div className="bg-[#050508] text-slate-100 font-sans min-h-screen p-4 md:p-8 flex flex-col gap-6 mx-auto w-full">
      {/* Header */}
      <header className="flex items-center justify-between w-full max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)] flex items-center justify-center">
            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase">
            Synth<span className="text-cyan-400">Snake</span>
          </h1>
        </div>
        <div className="flex gap-4 items-center">
          <div className="px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-slate-800 bg-slate-900/50 text-[10px] md:text-xs font-mono tracking-widest text-slate-400">
            SYSTEM STATUS: <span className={gameOver ? "text-fuchsia-400" : "text-cyan-400"}>{gameOver ? "FAIL" : "STABLE"}</span>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">v2.4.0</div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 grid-rows-none md:grid-rows-6 gap-6 place-content-center">
        {/* SCORE WIDGET */}
        <div className="md:col-span-3 md:row-span-2 bg-[#101014] rounded-3xl border border-slate-800 p-6 flex flex-col justify-between min-h-[160px]">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Session Score</span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl lg:text-4xl xl:text-6xl font-black text-fuchsia-500 drop-shadow-[0_0_10px_rgba(217,70,239,0.4)] tracking-tighter">{score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-slate-400">HIGH SCORE: {highScore.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span>
            <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden ml-4">
              <div className="h-full bg-fuchsia-500 transition-all duration-300" style={{ width: `${Math.min((score / Math.max(highScore, 100)) * 100, 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* GAME BOARD (BENTO CENTER) */}
        <div className="md:col-span-6 md:row-span-6 bg-[#121218] rounded-3xl border-2 border-cyan-500/30 relative overflow-hidden flex flex-col items-center justify-center group p-4 min-h-[400px]">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #06b6d4 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
          
          <div className="relative w-full max-w-[480px] aspect-square flex z-10 outline outline-1 outline-cyan-900/50 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <canvas 
              ref={canvasRef} 
              width={CANVAS_SIZE} 
              height={CANVAS_SIZE} 
              className="bg-[#080808] w-full h-full block z-10"
            />
            
            <AnimatePresence>
              {gameOver && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#050508]/80 backdrop-blur-md m-2 border border-fuchsia-500/50 shadow-[inset_0_0_50px_rgba(217,70,239,0.15)] rounded-xl"
                >
                  <div className="text-fuchsia-500 mb-2"><AlertCircle size={48} /></div>
                  <h2 className="text-3xl font-black tracking-widest uppercase mb-1 drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]">System Fail</h2>
                  <p className="font-mono text-white/70 mb-6 text-sm">FINAL SCORE: {score}</p>
                  <button 
                    onClick={resetGame}
                    className="flex items-center gap-2 bg-fuchsia-500/10 border border-fuchsia-500 text-fuchsia-500 px-6 py-2 rounded-full font-mono font-bold tracking-widest hover:bg-fuchsia-500 hover:text-black hover:shadow-[0_0_20px_#d946ef] transition-all duration-300 uppercase"
                  >
                    <RefreshCw size={16} /> Reboot
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isPaused && !gameOver && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#050508]/60 backdrop-blur-sm m-2 rounded-xl border border-cyan-500/30"
                >
                  <h2 className="text-2xl font-black tracking-widest uppercase text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">Paused</h2>
                  <p className="font-mono text-cyan-400 mt-2 text-xs">PRESS SPACE TO RESUME</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="absolute bottom-4 lg:bottom-6 left-1/2 -translate-x-1/2 flex gap-8 z-10 w-full justify-center opacity-70 group-hover:opacity-100 transition-opacity">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-cyan-400 mb-1 uppercase font-bold tracking-widest border border-[#121218] bg-[#121218] px-2 rounded-full absolute -top-3">Direction</span>
              <div className="flex gap-1 mt-3">
                <div className="w-6 h-6 border border-slate-700 flex items-center justify-center font-mono text-xs">W</div>
                <div className="w-6 h-6 border border-slate-700 flex items-center justify-center font-mono text-xs">A</div>
                <div className="w-6 h-6 border border-cyan-500 bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono text-xs">S</div>
                <div className="w-6 h-6 border border-slate-700 flex items-center justify-center font-mono text-xs">D</div>
              </div>
            </div>
          </div>
        </div>

        {/* PLAYLIST */}
        <div className="md:col-span-3 md:row-span-4 bg-[#101014] rounded-3xl border border-slate-800 p-6 flex flex-col max-h-[400px] md:max-h-none overflow-hidden">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 italic shrink-0">Queue / AI Horizon</span>
          <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
            {TRACKS.map((track, idx) => (
              <div 
                key={track.id} 
                onClick={() => { setCurrentTrackIndex(idx); setIsPlaying(true); }}
                className={`p-3 rounded-2xl flex items-center gap-3 transition-colors cursor-pointer ${currentTrackIndex === idx ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-slate-900/50 border border-slate-800 opacity-60 hover:opacity-100'}`}
              >
                <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-mono transition-colors ${currentTrackIndex === idx ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                   {String(idx + 1).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate text-slate-200">{track.title}</div>
                  <div className="text-[10px] text-slate-500 truncate">{track.artist}</div>
                </div>
                {currentTrackIndex === idx && (
                  <div className="h-4 w-4 shrink-0 bg-cyan-400 rounded-full flex items-center justify-center">
                     <div className="h-2 w-2 bg-black rounded-sm"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 shrink-0">
            <button className="w-full py-3 rounded-xl border border-slate-800 text-[10px] uppercase font-bold tracking-widest hover:bg-slate-800 transition-colors text-slate-300">
              Refresh Playlist
            </button>
          </div>
        </div>

        {/* PLAYER CONTROLS */}
        <div className="md:col-span-3 md:row-span-4 bg-[#101014] rounded-3xl border border-slate-800 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className={`aspect-square w-full rounded-2xl bg-gradient-to-br flex items-center justify-center border border-white/5 transition-all duration-1000 ${isPlaying ? 'from-cyan-900/30 to-fuchsia-900/30' : 'from-slate-900/40 to-slate-800/40'}`}>
               <div className={`w-24 h-24 border-2 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'border-cyan-500/30 animate-[pulse_2s_ease-in-out_infinite]' : 'border-white/10'}`}>
                  <div className={`w-16 h-16 border rounded-full transition-all ${isPlaying ? 'border-fuchsia-500/50' : 'border-white/20'}`}></div>
               </div>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg leading-tight truncate px-2">{TRACKS[currentTrackIndex].title}</h3>
              <p className="text-xs text-slate-500 truncate px-2">Playing from AI Horizon Engine</p>
            </div>
          </div>

          <div className="space-y-6 mt-4">
            <div className="flex items-center gap-4 justify-center">
              <button onClick={handlePrev} className="p-2 text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6L18 6v12z"/></svg>
              </button>
              <button onClick={togglePlay} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
              </button>
              <button onClick={handleNext} className="p-2 text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6zm9-12h2v12h-2z"/></svg>
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-500 w-8 text-right">
                {audioRef.current ? `${Math.floor(audioRef.current.currentTime / 60)}:${Math.floor(audioRef.current.currentTime % 60).toString().padStart(2, '0')}` : '0:00'}
              </span>
              <div 
                className="flex-1 h-1 bg-slate-800 rounded-full cursor-pointer relative"
                onClick={(e) => {
                  if(audioRef.current && audioRef.current.duration) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const p = (e.clientX - rect.left) / rect.width;
                    audioRef.current.currentTime = p * audioRef.current.duration;
                  }
                }}
              >
                <div className="h-full bg-cyan-400 absolute left-0 top-0 rounded-full pointer-events-none" style={{ width: `${progress}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_white]"></div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 w-8">
                {audioRef.current && !isNaN(audioRef.current.duration) ? `${Math.floor(audioRef.current.duration / 60)}:${Math.floor(audioRef.current.duration % 60).toString().padStart(2, '0')}` : '0:00'}
              </span>
            </div>
            
            <div className="flex justify-between items-center mt-2 px-2">
              <button onClick={() => setIsMuted(!isMuted)} className="text-slate-500 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input 
                type="range" 
                min="0" max="1" step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={(e) => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
                className="w-24 accent-slate-300 h-1 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* MINI WIDGETS */}
        <div className="md:col-span-3 md:row-span-2 bg-fuchsia-500 rounded-3xl p-6 flex flex-col justify-between overflow-hidden relative min-h-[160px]">
          <div className="absolute -right-4 -top-4 w-24 h-24 border-[12px] border-white/20 rounded-full pointer-events-none mb-2"></div>
          <span className="text-black text-xs font-black uppercase tracking-widest relative z-10">Multiplier</span>
          <div className="text-4xl lg:text-3xl xl:text-4xl font-black text-black tracking-tighter italic relative z-10">x{(1 + (score/1000)).toFixed(1)}</div>
          <p className="text-black/60 text-[10px] font-bold relative z-10">SPEED BOOST READY</p>
        </div>

      </main>

      <footer className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-slate-600 w-full max-w-7xl mx-auto mt-4">
        <div>Neural Engine: V3-PRO</div>
        <div className="flex gap-6">
          <span className="text-cyan-500/60 hidden sm:inline">Latency: 12ms</span>
          <span>Seed: #88219-X</span>
        </div>
      </footer>
    </div>
  );
}

