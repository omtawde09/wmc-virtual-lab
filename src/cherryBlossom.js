export function initCherryBlossoms(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationFrameId;

  // Track wind speed that can be manipulated by GSAP
  const windControl = window.sakuraWind || {
    speedX: 0.8,
    speedY: 1.2,
    wobbleSpeed: 0.02
  };

  // Ensure it is bound
  window.sakuraWind = windControl;

  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const petalsCount = 45;
  const petals = [];

  class Petal {
    constructor() {
      this.reset();
      this.y = Math.random() * height; // Distribute initially across screen
    }

    reset() {
      this.x = Math.random() * width;
      this.y = -20;
      this.size = Math.random() * 8 + 6;
      this.opacity = Math.random() * 0.4 + 0.5;
      this.wobble = Math.random() * Math.PI;
      this.wobbleSpeed = Math.random() * 0.02 + 0.01;
      this.rotation = Math.random() * 360;
      this.rotationSpeed = Math.random() * 1.5 - 0.75;
    }

    update() {
      // Fall down and drift
      this.y += windControl.speedY + Math.random() * 0.5;
      this.x += Math.sin(this.wobble) * windControl.speedX;
      this.wobble += windControl.wobbleSpeed;
      this.rotation += this.rotationSpeed;

      // Reset if offscreen
      if (this.y > height + 20 || this.x > width + 20 || this.x < -20) {
        this.reset();
      }
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.fillStyle = `rgba(255, 183, 197, ${this.opacity})`;
      
      // Draw petal shape using bezier curves
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(this.size / 2, -this.size / 2, this.size, 0, 0, this.size);
      ctx.bezierCurveTo(-this.size, 0, -this.size / 2, -this.size / 2, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  }

  // Populate petals
  for (let i = 0; i < petalsCount; i++) {
    petals.push(new Petal());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    petals.forEach(petal => {
      petal.update();
      petal.draw();
    });

    animationFrameId = requestAnimationFrame(animate);
  }

  animate();

  return () => {
    cancelAnimationFrame(animationFrameId);
  };
}
