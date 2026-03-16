import { useEffect, useRef } from "react";

export default function CyberGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let time = 0;

    // Matrix rain characters
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモ";
    const columns: { y: number; speed: number; chars: string[] }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Reinitialize columns
      columns.length = 0;
      const colCount = Math.ceil(canvas.width / 20);
      for (let i = 0; i < colCount; i++) {
        columns.push({
          y: Math.random() * canvas.height,
          speed: 0.5 + Math.random() * 1.5,
          chars: Array.from({ length: 30 }, () => chars[Math.floor(Math.random() * chars.length)]),
        });
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      time += 0.005;
      
      // Semi-transparent background for trail effect
      ctx.fillStyle = "rgba(3, 7, 18, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const spacing = 60;
      const cols = Math.ceil(canvas.width / spacing) + 1;
      const rows = Math.ceil(canvas.height / spacing) + 1;

      // Grid lines
      for (let i = 0; i < cols; i++) {
        const x = i * spacing;
        const wave = Math.sin(time + i * 0.15) * 0.3;
        const alpha = 0.02 + wave * 0.015;
        ctx.strokeStyle = `hsla(190, 100%, 50%, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let j = 0; j < rows; j++) {
        const y = j * spacing;
        const wave = Math.sin(time + j * 0.15) * 0.3;
        const alpha = 0.02 + wave * 0.015;
        ctx.strokeStyle = `hsla(190, 100%, 50%, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Intersection dots
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const pulse = Math.sin(time * 2 + i * 0.3 + j * 0.3);
          if (pulse > 0.7) {
            const alpha = (pulse - 0.7) * 0.4;
            ctx.fillStyle = `hsla(190, 100%, 60%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(i * spacing, j * spacing, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Matrix rain effect
      ctx.font = "12px monospace";
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const x = i * 20;
        
        for (let j = 0; j < col.chars.length; j++) {
          const y = col.y - j * 16;
          if (y < 0 || y > canvas.height) continue;
          
          const fade = 1 - j / col.chars.length;
          if (j === 0) {
            ctx.fillStyle = `hsla(190, 100%, 90%, ${fade * 0.15})`;
          } else {
            ctx.fillStyle = `hsla(190, 100%, 50%, ${fade * 0.06})`;
          }
          ctx.fillText(col.chars[j], x, y);
        }
        
        col.y += col.speed;
        if (col.y - col.chars.length * 16 > canvas.height) {
          col.y = -16;
          col.chars = Array.from({ length: 30 }, () => chars[Math.floor(Math.random() * chars.length)]);
        }
        
        // Randomly change characters
        if (Math.random() < 0.01) {
          const idx = Math.floor(Math.random() * col.chars.length);
          col.chars[idx] = chars[Math.floor(Math.random() * chars.length)];
        }
      }

      // Scanning line
      const scanY = ((time * 40) % (canvas.height + 200)) - 100;
      const scanGrad = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
      scanGrad.addColorStop(0, "hsla(190, 100%, 50%, 0)");
      scanGrad.addColorStop(0.5, "hsla(190, 100%, 50%, 0.03)");
      scanGrad.addColorStop(1, "hsla(190, 100%, 50%, 0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 50, canvas.width, 100);

      // Hex data streams (occasional)
      if (Math.random() < 0.02) {
        const hexStr = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const hx = Math.random() * canvas.width;
        const hy = Math.random() * canvas.height;
        ctx.fillStyle = "hsla(142, 71%, 45%, 0.08)";
        ctx.font = "9px monospace";
        ctx.fillText(`0x${hexStr}`, hx, hy);
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  );
}
