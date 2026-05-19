'use client';

import { useEffect, useRef, useState } from 'react';

const CONFIG = {
  GAME_TIME: 30,
  INITIAL_HP: 100,
  INITIAL_LIVES: 5,
  PERFECT_DAMAGE: 30,
  GOOD_DAMAGE: 12,
  PERFECT_RANGE: 2.5, 
  GOOD_RANGE: 5.0,    
  LINE_WIDTH: 760,
  HIT_ZONES: [10, 30, 50, 70, 90],
};

interface Rank { score: number; name: string; date: string; }
interface DamagePop { id: number; value: string; x: number; y: number; type: 'PERFECT' | 'GOOD' | 'MISS'; }

class Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
  constructor(x: number, y: number, color: string, isConfetti = false) {
    this.x = x; this.y = y;
    const angle = isConfetti ? Math.random() * Math.PI + Math.PI : Math.random() * Math.PI * 2;
    const speed = isConfetti ? Math.random() * 15 + 5 : Math.random() * 10 + 3;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0;
    this.color = color;
    this.size = isConfetti ? Math.random() * 8 + 4 : Math.random() * 5 + 2;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.vy += 0.15;
    this.life -= 0.02;
  }
}

export default function OctopusFishingGame() {
  const [mounted, setMounted] = useState(false);
  const [gameState, setGameState] = useState<'READY' | 'PLAYING' | 'WIN' | 'LOSE' | 'RANKING_ENTRY'>('READY');
  const [hp, setHp] = useState(CONFIG.INITIAL_HP);
  const [lives, setLives] = useState(CONFIG.INITIAL_LIVES);
  const [timeLeft, setTimeLeft] = useState(CONFIG.GAME_TIME);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [rankings, setRankings] = useState<Rank[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [damagePops, setDamagePops] = useState<DamagePop[]>([]);
  const [fishAnimState, setFishAnimState] = useState<'idle' | 'hurt' | 'death'>('idle');
  const [frameIndex, setFrameIndex] = useState(0);
  const [isShake, setIsShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [deathFall, setDeathFall] = useState(false);
  
  // 타격 지점 이펙트 상태 추가 (각 존의 활성화 여부 및 타입 저장)
  const [hitZoneStates, setHitZoneStates] = useState<('PERFECT' | 'GOOD' | null)[]>(new Array(CONFIG.HIT_ZONES.length).fill(null));
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const isEndingRef = useRef(false);
  const fishPosRef = useRef(0);
  const [renderFishPos, setRenderFishPos] = useState(0);
  const directionRef = useRef(1);
  const speedRef = useRef(1);
  const targetSpeedRef = useRef(3.0);
  const animationRef = useRef<number | null>(null);
  const behaviorTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('octopus-rank-v2');
    if (saved) setRankings(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    targetSpeedRef.current = hp <= 50 ? 7.5 : 3.0;
  }, [hp, gameState]);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter(p => p.life > 0);
      particles.current.forEach(p => {
        p.update();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.shadowBlur = 0;
      });
      requestAnimationFrame(render);
    };
    render();
  }, [mounted]);

  useEffect(() => {
    if (gameState !== 'PLAYING' || !mounted) return;
    const animate = () => {
      if (isEndingRef.current) return;
      speedRef.current += (targetSpeedRef.current - speedRef.current) * 0.1;
      fishPosRef.current += directionRef.current * speedRef.current;
      if (fishPosRef.current >= 100) { fishPosRef.current = 100; directionRef.current = -1; }
      if (fishPosRef.current <= 0) { fishPosRef.current = 0; directionRef.current = 1; }
      setRenderFishPos(fishPosRef.current);
      animationRef.current = requestAnimationFrame(animate);
    };
    const updateFishBehavior = () => {
      if (isEndingRef.current) return;
      if (Math.random() < 0.4) directionRef.current *= -1;
      behaviorTimerRef.current = setTimeout(updateFishBehavior, hp <= 50 ? 400 : 1000);
    };
    animationRef.current = requestAnimationFrame(animate);
    updateFishBehavior();
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleGameOver('LOSE'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { 
      clearInterval(timer); 
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (behaviorTimerRef.current) clearTimeout(behaviorTimerRef.current);
    };
  }, [gameState, mounted, hp <= 50]);

  useEffect(() => {
    const totalFrames = fishAnimState === 'idle' ? 6 : fishAnimState === 'hurt' ? 2 : 6;
    const timer = setInterval(() => {
      setFrameIndex(prev => (fishAnimState === 'death' && prev >= totalFrames - 1) ? prev : (prev + 1) % totalFrames);
    }, 120);
    return () => clearInterval(timer);
  }, [fishAnimState]);

  const handleGameOver = (type: 'WIN' | 'LOSE') => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setGameState(type === 'LOSE' ? 'LOSE' : 'WIN');
  };

  const handlePull = () => {
    if (gameState !== 'PLAYING' || isEndingRef.current) return;
    let result: 'PERFECT' | 'GOOD' | 'MISS' = 'MISS';
    let hitIndex = -1;

    // 히트 판정 루프
    for (let i = 0; i < CONFIG.HIT_ZONES.length; i++) {
      const distance = Math.abs(renderFishPos - CONFIG.HIT_ZONES[i]);
      if (distance <= CONFIG.PERFECT_RANGE) { 
        result = 'PERFECT'; 
        hitIndex = i;
        break; 
      } else if (distance <= CONFIG.GOOD_RANGE) { 
        result = 'GOOD'; 
        hitIndex = i;
        break; 
      }
    }
    
    const fishXPos = (renderFishPos / 100) * CONFIG.LINE_WIDTH - CONFIG.LINE_WIDTH / 2;
    const popId = Date.now();

    if (result !== 'MISS') {
      // 타격 지점 색상 변경 효과 적용
      const newStates = [...hitZoneStates];
      newStates[hitIndex] = result;
      setHitZoneStates(newStates);
      
      // 0.3초 후 색상 원래대로 복구
      setTimeout(() => {
        setHitZoneStates(prev => {
          const reset = [...prev];
          reset[hitIndex] = null;
          return reset;
        });
      }, 300);

      setIsShake(true); setFlash(true);
      setTimeout(() => { setIsShake(false); setFlash(false); }, 150);
      
      for (let i = 0; i < 25; i++) {
        particles.current.push(new Particle(window.innerWidth/2 + fishXPos, window.innerHeight/2, result === 'PERFECT' ? '#fde047' : '#ffffff'));
      }
      
      const newCombo = combo + 1; 
      setCombo(newCombo);
      const earnedScore = Math.floor((result === 'PERFECT' ? 150 : 80) * (1 + newCombo * 0.15));
      setScore(prev => prev + earnedScore);
      setFishAnimState('hurt'); 
      setTimeout(() => { if (!isEndingRef.current) setFishAnimState('idle'); }, 400);
      
      setHp(prev => {
        const next = Math.max(0, prev - (result === 'PERFECT' ? CONFIG.PERFECT_DAMAGE : CONFIG.GOOD_DAMAGE));
        if (next === 0) {
          isEndingRef.current = true; setFishAnimState('death');
          const finalScore = score + earnedScore + 1000; setScore(finalScore);
          setTimeout(() => setDeathFall(true), 1000);
          setTimeout(() => {
            const isTopFive = rankings.length < 5 || (rankings.length > 0 && finalScore > rankings[rankings.length - 1].score);
            setGameState(isTopFive ? 'RANKING_ENTRY' : 'WIN');
          }, 2500);
        }
        return next;
      });
      setDamagePops(prev => [...prev, { id: popId, value: result === 'PERFECT' ? 'PERFECT!!' : 'HIT!', x: fishXPos, y: -120, type: result }]);
    } else {
      setCombo(0);
      setLives(prev => {
        const next = prev - 1;
        if (next <= 0) handleGameOver('LOSE');
        return next;
      });
      setDamagePops(prev => [...prev, { id: popId, value: 'MISS!', x: fishXPos, y: -80, type: 'MISS' }]);
      setIsShake(true); setTimeout(() => setIsShake(false), 300);
    }
    setTimeout(() => setDamagePops(prev => prev.filter(p => p.id !== popId)), 800);
  };

  const startGame = () => {
    isEndingRef.current = false; setHp(100); setTimeLeft(30); setLives(5);
    setScore(0); setCombo(0); setDeathFall(false); setFishAnimState('idle');
    speedRef.current = 1; targetSpeedRef.current = 3.0;
    setGameState('PLAYING'); setDamagePops([]); particles.current = [];
    setHitZoneStates(new Array(CONFIG.HIT_ZONES.length).fill(null));
  };

  const saveRanking = () => {
    const newRank = [...rankings, { score, name: playerName || 'Unknown', date: new Date().toLocaleDateString() }].sort((a, b) => b.score - a.score).slice(0, 5);
    setRankings(newRank); localStorage.setItem('octopus-rank-v2', JSON.stringify(newRank));
    setGameState('READY'); setPlayerName('');
  };

  if (!mounted) return <div className="w-screen h-screen bg-[#0a0a0a]" />;

  return (
    <main className={`relative w-screen h-screen overflow-hidden flex items-center justify-center bg-[#050505] ${isShake ? 'animate-shake' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
        main { font-family: 'Jua', sans-serif; }
        @keyframes shake { 0%, 100% { transform: translate(0,0); } 25% { transform: translate(-8px, 4px); } 50% { transform: translate(8px, -4px); } }
        .animate-shake { animation: shake 0.1s linear infinite; }
        .pixel-border { border: 4px solid #000; box-shadow: inset -4px -4px 0px 0px rgba(0,0,0,0.3), 4px 4px 0px 0px rgba(0,0,0,0.1); }
        .heart-glow { filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.8)); animation: beat 0.8s infinite alternate; }
        @keyframes beat { from { transform: scale(1); } to { transform: scale(1.15); } }
        .hit-zone-neon { box-shadow: 0 0 15px #fff, inset 0 0 10px #fff; background: rgba(255, 255, 255, 0.2); transition: all 0.1s; }
        .hit-zone-perfect { box-shadow: 0 0 30px #fde047, inset 0 0 20px #fde047; background: #fde047; border-color: #fff; transform: translateX(-50%) scale(1.3) !important; }
        .hit-zone-good { box-shadow: 0 0 25px #22d3ee, inset 0 0 15px #22d3ee; background: #22d3ee; border-color: #fff; transform: translateX(-50%) scale(1.2) !important; }
        .damage-float { animation: damage-up 0.8s forwards; text-shadow: 3px 3px 0 #000; }
        @keyframes damage-up { 0% { opacity: 0; transform: translateY(40px) scale(0.5); } 20% { opacity: 1; transform: translateY(0) scale(1.2); } 100% { opacity: 0; transform: translateY(-120px) scale(1); } }
        .animate-dislike { animation: dislike-fall 2s forwards cubic-bezier(0.4, 0, 1, 1); }
        @keyframes dislike-fall { 0% { transform: translateY(-50px) scale(0) rotate(0deg); opacity: 0; } 20% { transform: translateY(0) scale(1.5) rotate(0deg); opacity: 1; } 100% { transform: translateY(1000px) scale(1) rotate(0deg); opacity: 0; } }
      `}</style>

      <div className="absolute inset-0 z-0 bg-no-repeat bg-cover bg-center opacity-80" style={{ backgroundImage: "url('bg/bg.gif')" }} />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-blue-900/20 to-black/60" />
      <div className={`absolute inset-0 z-40 pointer-events-none transition-opacity ${flash ? 'opacity-30 bg-white' : 'opacity-0'}`} />

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        
        {/* HUD */}
        <div className="w-full max-w-3xl mb-10 flex flex-col items-center bg-black/50 p-8 rounded-[50px] border-4 border-white/20 backdrop-blur-md shadow-2xl">
          <div className="flex justify-between w-full mb-6 items-center">
            <div className="flex gap-3 bg-black/40 px-6 py-3 rounded-full border-2 border-white/10">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`text-4xl ${i < lives ? 'text-red-500 heart-glow' : 'text-gray-800'}`}>
                  {i < lives ? '♥' : '♡'}
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-8xl font-black text-yellow-400 tracking-tighter drop-shadow-[0_6px_0_rgba(0,0,0,1)]">
                {score.toLocaleString()}
              </span>
              {combo > 1 && (
                <div className="bg-cyan-500 text-black px-4 py-1 rounded-md font-bold text-2xl animate-bounce mt-[-10px] pixel-border">
                  {combo} COMBO!
                </div>
              )}
            </div>
            <div className="flex flex-col items-end">
              <div className="text-white/60 text-xl mb-1 uppercase tracking-widest">Time</div>
              <div className={`text-5xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {String(timeLeft).padStart(2, '0')}s
              </div>
            </div>
          </div>
          <div className="w-full h-10 bg-gray-900/80 border-4 border-black rounded-2xl overflow-hidden relative shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)]">
            <div className={`h-full transition-all duration-300 relative ${hp > 50 ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-red-700 to-red-500'}`} style={{ width: `${hp}%` }}>
              <div className="absolute inset-0 bg-white/20 h-1/2 w-full" />
            </div>
          </div>
        </div>

        {/* 레일 및 타격 효과 적용 히트 존 */}
        <div className="relative w-[850px] h-52 flex items-center justify-center mb-12 bg-white/5 rounded-[100px] border-2 border-white/5 shadow-inner">
          <div className="absolute w-[90%] h-[2px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          
          {CONFIG.HIT_ZONES.map((z, i) => (
            <div 
              key={i} 
              className={`absolute w-16 h-16 border-4 border-white rounded-full flex items-center justify-center hit-zone-neon 
                ${hitZoneStates[i] === 'PERFECT' ? 'hit-zone-perfect' : ''} 
                ${hitZoneStates[i] === 'GOOD' ? 'hit-zone-good' : ''}`} 
              style={{ left: `calc(50% + ${(z/100)*760-380}px)`, transform: 'translateX(-50%)' }} 
            >
              <div className={`w-2 h-2 rounded-full ${hitZoneStates[i] ? 'bg-white' : 'bg-white animate-ping'}`} />
            </div>
          ))}

          {damagePops.map(pop => (
            <div key={pop.id} className="absolute damage-float z-50 font-black text-6xl text-white italic tracking-tighter" style={{ left: `calc(50% + ${pop.x}px)`, top: pop.y }}>
              {pop.value}
            </div>
          ))}

          <div className="absolute z-20" 
               style={{ 
                 left: `calc(50% + ${(renderFishPos/100)*760-380}px)`, 
                 top: '50%',
                 transition: deathFall ? 'transform 1.5s ease-in, opacity 1s' : 'none',
                 transform: `translate(-50%, ${deathFall ? '600px' : '-50%'}) ${directionRef.current < 0 ? 'scaleX(-1)' : ''} ${fishAnimState === 'death' ? 'rotate(180deg) scale(3.5)' : 'scale(3)'}`,
                 opacity: deathFall ? 0 : 1,
                 filter: hp <= 50 ? 'drop-shadow(0 0 20px #ff0000)' : 'drop-shadow(0 0 15px rgba(255,255,255,0.3))'
               }}>
            <div className="overflow-hidden w-16 h-16">
              <img src={`/fish/${fishAnimState}.png`} className="max-w-none" style={{ height: '64px', transform: `translateX(-${frameIndex * 64}px)`, imageRendering: 'pixelated' }} />
            </div>
          </div>
        </div>

        <button onPointerDown={handlePull} className="pixel-border w-96 h-32 bg-gradient-to-b from-blue-500 to-blue-700 text-white text-4xl rounded-3xl active:translate-y-2 transition-all">당겨요!!!</button>
      </div>

      <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} className="absolute inset-0 pointer-events-none z-50" />

      {gameState !== 'PLAYING' && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex flex-col items-center justify-center backdrop-blur-md">
          {gameState === 'LOSE' && <div className="absolute top-1/4 text-[200px] animate-dislike">👎</div>}
          {gameState === 'WIN' && <div className="text-yellow-400 text-6xl mb-4 animate-bounce font-black">CHAMPION!</div>}
          <h1 className="text-5xl text-white mb-10 tracking-tighter drop-shadow-lg">
            {gameState === 'READY' ? '나의 문어 선생님' : gameState === 'WIN' ? 'MISSION CLEAR' : gameState === 'LOSE' ? '개모태' : '신기록 달성!'}
          </h1>
          {gameState === 'RANKING_ENTRY' ? (
            <div className="flex flex-col items-center">
              <input autoFocus maxLength={8} value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="NAME" className="w-80 h-24 text-center text-4xl mb-6 bg-blue-900/50 border-4 border-white text-white rounded-3xl outline-none pixel-border" />
              <button onClick={saveRanking} className="pixel-border px-20 py-6 bg-green-500 text-white text-4xl font-bold">SAVE</button>
            </div>
          ) : (
            <div className="w-full max-w-lg bg-white/10 p-10 rounded-[50px] mb-8 border-4 border-white/20 shadow-2xl">
              <div className="text-white/40 text-center mb-6 text-xl tracking-widest uppercase">Hall of Fame</div>
              {rankings.map((r, i) => (
                <div key={i} className="flex justify-between text-white text-3xl mb-4 border-b-2 border-white/5 pb-2">
                  <span className="font-bold text-cyan-400">#{i+1} {r.name}</span>
                  <span className="text-yellow-400">{r.score.toLocaleString()}</span>
                </div>
              ))}
              <button onClick={startGame} className="pixel-border w-full mt-8 py-8 bg-yellow-400 text-black text-6xl font-black hover:scale-105 transition-transform">Ready?</button>
            </div>
          )}
        </div>
      )}
      {/* 광고주 모심 섹션 */}
      <div className="absolute bottom-6 w-full flex justify-center px-4">
        <div className="w-full max-w-4xl bg-black/60 border-2 border-dashed border-yellow-400/50 p-4 rounded-2xl flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-400 text-black px-3 py-1 rounded-md font-black animate-pulse text-sm">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-white text-lg font-bold">🐙 "문어도 반한 최고의 맛, 문어빵 광고주 구함"</span>
              <span className="text-white/40 text-xs">문의: 010-OCTO-PUSS</span>
            </div>
          </div>
          
          <div className="hidden md:block flex-1 mx-10 overflow-hidden whitespace-nowrap relative">
            <div className="inline-block animate-marquee text-cyan-400/80 text-sm italic">
              [긴급] 이 자리에 광고를 넣으면 문어가 더 잘 잡힐지도 모릅니다! ─ 지금 바로 연락주세요! ─ 광고 문의 환영! ─ 낚시왕의 후원자를 찾습니다!
            </div>
          </div>

          <button 
            onClick={() => alert('진짜 광고하실 건가요? 🐙')}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm transition-colors whitespace-nowrap"
          >
            광고주 입점하기
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 15s linear infinite;
        }
      `}</style>
    </main>
  );
}