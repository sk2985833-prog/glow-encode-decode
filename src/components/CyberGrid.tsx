import { useEffect, useRef } from "react";

export default function CyberGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      time += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const spacing = 60;
      const cols = Math.ceil(canvas.width / spacing) + 1;
      const rows = Math.ceil(canvas.height / spacing) + 1;

      // Vertical lines
      for (let i = 0; i < cols; i++) {
        const x = i * spacing;
        const wave = Math.sin(time + i * 0.15) * 0.3;
        const alpha = 0.03 + wave * 0.02;
        ctx.strokeStyle = `hsla(190, 100%, 50%, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let j = 0; j < rows; j++) {
        const y = j * spacing;
        const wave = Math.sin(time + j * 0.15) * 0.3;
        const alpha = 0.03 + wave * 0.02;
        ctx.strokeStyle = `hsla(190, 100%, 50%, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Glowing intersection dots
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const pulse = Math.sin(time * 2 + i * 0.3 + j * 0.3);
          if (pulse > 0.7) {
            const alpha = (pulse - 0.7) * 0.5;
            ctx.fillStyle = `hsla(190, 100%, 60%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(i * spacing, j * spacing, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Scanning line effect
      const scanY = ((time * 50) % (canvas.height + 200)) - 100;
      const scanGrad = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
      scanGrad.addColorStop(0, "hsla(190, 100%, 50%, 0)");
      scanGrad.addColorStop(0.5, "hsla(190, 100%, 50%, 0.04)");
      scanGrad.addColorStop(1, "hsla(190, 100%, 50%, 0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 50, canvas.width, 100);

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
      style={{ opacity: 0.6 }}
    />
  );
}
