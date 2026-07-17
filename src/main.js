import './style.css'
import { initCherryBlossoms } from './cherryBlossom'
import { initNodesBackground } from './nodesBackground'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, MotionPathPlugin)

// Initialize wind control object globally to prevent any undefined target errors in GSAP
window.sakuraWind = {
  speedX: 0.8,
  speedY: 1.2,
  wobbleSpeed: 0.02
}

// Wrap initialization in window load event to ensure all styles, images, and DOM structures are fully resolved
window.addEventListener('load', () => {
  console.log("Aether Landing Page: Initializing GSAP and ScrollTrigger...");

  // Start Canvas Particle Systems (only if elements exist)
  if (document.getElementById('cherry-blossom-canvas')) {
    initCherryBlossoms('cherry-blossom-canvas');
  }
  if (document.getElementById('nodes-canvas')) {
    initNodesBackground('nodes-canvas');
  }

  // Set Initial States
  gsap.set("#scene-1", { autoAlpha: 1 })
  gsap.set("#scene-2", { autoAlpha: 0 })
  gsap.set("#scene-3", { autoAlpha: 0 })
  gsap.set("#scene-4", { autoAlpha: 0 })
  gsap.set("#scene-5", { autoAlpha: 0 })

  // Global phone wrapper initial positions
  gsap.set("#phone-wrapper", { 
    scale: 0.1, 
    y: 200, 
    opacity: 0, 
    transformOrigin: "center center"
  })
  
  // 3D device initial rotation
  gsap.set("#phone-element", {
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    transformOrigin: "center center"
  })

  // Initialize card deck values for Scene 4 fanning
  const cards = gsap.utils.toArray('.deck-card')
  const fannedOffsets = [
    { x: -160, y: 150, rotation: -20, scale: 0.85 },
    { x: -50, y: 110, rotation: -8, scale: 0.9 },
    { x: 50, y: 110, rotation: 8, scale: 0.9 },
    { x: 160, y: 150, rotation: 20, scale: 0.85 }
  ]

  // Statically position cards in fanned state relative to their layout spots
  cards.forEach((card, idx) => {
    gsap.set(card, {
      x: fannedOffsets[idx].x,
      y: fannedOffsets[idx].y,
      rotation: fannedOffsets[idx].rotation,
      scale: fannedOffsets[idx].scale,
      transformOrigin: "bottom center"
    })
  })

  // Statically position collage elements in Scene 5
  gsap.set(".collage-item", { opacity: 0, scale: 0.7, y: 40 })
  gsap.set(".cta-box", { opacity: 0, scale: 0.88 })

  // Camera Zoom Video Setup
  const zoomVideo = document.getElementById('zoom-video');
  let duration = 6.4;
  let currentDirection = 0; // 0 = idle, 1 = forward, -1 = backward
  if (zoomVideo) {
    zoomVideo.addEventListener('loadedmetadata', () => {
      duration = zoomVideo.duration || 6.4;
    });
  }
  
  const initTimeline = () => {
    duration = (zoomVideo && zoomVideo.duration) ? zoomVideo.duration : 6.4;
    console.log("Zoom video duration:", duration);
    
    // Master Cinematic Scroll Timeline
    const masterTL = gsap.timeline({
      scrollTrigger: {
        trigger: "#scroll-container",
        start: "top top",
        end: "bottom bottom",
        scrub: 1.5, // smooth scrubbing duration
        pin: ".viewport",
        anticipatePin: 1,
        onUpdate: (self) => {
          const progress = self.progress;
          // Scene 2 starts immediately when scrolling starts (above 2%)
          if (progress >= 0.02) {
            if (currentDirection !== 1) {
              currentDirection = 1;
              console.log("Timeline scroll: Playing video forward and locking...");
              if (zoomVideo) {
                gsap.killTweensOf(zoomVideo);
                gsap.killTweensOf("#phone-wrapper");
                gsap.killTweensOf(".zoom-video-container");
                
                zoomVideo.play();
                
                const remaining = Math.max(0, duration - zoomVideo.currentTime);
                gsap.to("#phone-wrapper", {
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  duration: 0.6,
                  delay: Math.max(0, remaining - 0.6),
                  ease: "power2.inOut",
                  overwrite: "auto"
                });
                gsap.to(".zoom-video-container", {
                  opacity: 0,
                  duration: 0.5,
                  delay: Math.max(0, remaining - 0.4),
                  overwrite: "auto"
                });
              }
            }
          } else {
            // Scroll back to top (Scene 1) -> Reset for replay
            if (currentDirection !== 0) {
              currentDirection = 0;
              console.log("Timeline scroll: resetting zoom video to start...");
              if (zoomVideo) {
                zoomVideo.pause();
                zoomVideo.currentTime = 0;
              }
              gsap.killTweensOf(zoomVideo);
              gsap.killTweensOf("#phone-wrapper");
              gsap.killTweensOf(".zoom-video-container");
              
              gsap.to("#phone-wrapper", {
                opacity: 0,
                scale: 0.1,
                y: 200,
                duration: 0.4,
                ease: "power2.inOut",
                overwrite: "auto"
              });
              gsap.to(".zoom-video-container", {
                opacity: 1,
                duration: 0.4,
                overwrite: "auto"
              });
            }
          }
        }
      }
    })

    // Build Timeline Choreography

    // --- SCENE 1: OPENING ATMOSPHERE -> CAMERA PUSH (Snappy transition with no gap) ---
    masterTL
      .to(".title-overlay", { 
        opacity: 0, 
        duration: 0.4, 
        ease: "power1.out" 
      })
      .to(".classroom-container", { 
        opacity: 0, 
        duration: 0.4 
      }, "<")
      .to(".zoom-video-container", { 
        opacity: 1, 
        duration: 0.4 
      }, "<")
      .to("#scene-1", { 
        autoAlpha: 0, 
        duration: 0.4 
      }, "<")

    // --- SCENE 2: CAMERA PUSH TO PHONE (Locked zoom sequence) ---
    masterTL
      .to("#scene-2", { 
        autoAlpha: 1, 
        duration: 0.1 
      })
      // Blank spacer representing the scroll space allocated to the video zoom
      .to({}, { duration: 3.5 })
      // Staggered reveal of chat messages (triggered after the video space)
      .to("#msg-1", { 
        opacity: 1, 
        y: 0, 
        duration: 0.8, 
        ease: "power1.out" 
      })
      .to("#msg-2", { 
        opacity: 1, 
        y: 0, 
        duration: 0.8, 
        ease: "power1.out" 
      }, "+=0.3")
      .to("#msg-3", { 
        opacity: 1, 
        y: 0, 
        duration: 1, 
        ease: "power1.out" 
      }, "+=0.3")



    // --- SCENE 3: SHOCK AND FALL (0.42 to 0.65) ---
    masterTL
      .to("#scene-2", { 
        autoAlpha: 0, 
        duration: 0.2 
      })
      .to(".viewport", { 
        backgroundColor: "#000000", 
        duration: 0.6 
      }, "<")
      .to("#scene-3", { 
        autoAlpha: 1, 
        duration: 0.2 
      }, "-=0.2")

      // Step-by-step bouncing fall down floating steps (holographic reveal physics)
      
      // Step 1: Hit, bounce, then reveal Step 1
      .to("#phone-wrapper", {
        x: "24vw",
        y: "-38vh",
        scale: 0.55,
        duration: 0.8,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 110,
        rotationY: -35,
        rotationZ: -15,
        duration: 0.8,
        ease: "power2.in"
      }, "<")
      // Bounce recoil 1 (rebound and roll on platform)
      .to("#phone-wrapper", { y: "-42vh", x: "22vw", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationX: 180, rotationY: -60, rotationZ: -30, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "-38vh", x: "21vw", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationX: 240, rotationY: -75, rotationZ: -45, duration: 0.15, ease: "power1.in" }, "<")
      // Reveal Step 1 (reveals after impact settles)
      .to("#step-1", {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out"
      }, "-=0.25")

      // Step 2: Fall, hit, bounce, then reveal Step 2
      .to("#phone-wrapper", {
        x: "8vw",
        y: "-22vh",
        scale: 0.68,
        duration: 0.7,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 380,
        rotationY: -45,
        rotationZ: -60,
        duration: 0.7,
        ease: "power2.in"
      }, "<")
      // Bounce recoil 2
      .to("#phone-wrapper", { y: "-25vh", x: "6vw", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationX: 430, rotationY: -30, rotationZ: -75, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "-22vh", x: "5vw", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationX: 480, rotationY: -15, rotationZ: -90, duration: 0.15, ease: "power1.in" }, "<")
      // Reveal Step 2
      .to("#step-2", {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out"
      }, "-=0.25")

      // Step 3: Fall, hit, bounce, then reveal Step 3
      .to("#phone-wrapper", {
        x: "-8vw",
        y: "-2vh",
        scale: 0.80,
        duration: 0.7,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 600,
        rotationY: 20,
        rotationZ: -110,
        duration: 0.7,
        ease: "power2.in"
      }, "<")
      // Bounce recoil 3
      .to("#phone-wrapper", { y: "-5vh", x: "-10vw", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationX: 650, rotationY: 35, rotationZ: -125, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "-2vh", x: "-11vw", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationX: 700, rotationY: 45, rotationZ: -140, duration: 0.15, ease: "power1.in" }, "<")
      // Reveal Step 3
      .to("#step-3", {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out"
      }, "-=0.25")

      // Step 4: Fall, hit, bounce, then reveal Step 4
      .to("#phone-wrapper", {
        x: "-24vw",
        y: "18vh",
        scale: 0.95,
        duration: 0.7,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 820,
        rotationY: 60,
        rotationZ: -160,
        duration: 0.7,
        ease: "power2.in"
      }, "<")
      // Bounce recoil 4
      .to("#phone-wrapper", { y: "15vh", x: "-26vw", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationX: 860, rotationY: 70, rotationZ: -175, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "18vh", x: "-27vw", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationX: 900, rotationY: 80, rotationZ: -190, duration: 0.15, ease: "power1.in" }, "<")
      // Reveal Step 4
      .to("#step-4", {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out"
      }, "-=0.25")

      // Step 5: Fall, hit, bounce, then reveal Step 5
      .to("#phone-wrapper", {
        x: "-40vw",
        y: "38vh",
        scale: 1.15,
        duration: 0.8,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 1020,
        rotationY: 95,
        rotationZ: -210,
        duration: 0.8,
        ease: "power2.in"
      }, "<")
      // Bounce recoil 5
      .to("#phone-wrapper", { y: "35vh", x: "-42vw", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationX: 1060, rotationY: 105, rotationZ: -225, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "38vh", x: "-43vw", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationX: 1100, rotationY: 110, rotationZ: -240, duration: 0.15, ease: "power1.in" }, "<")
      // Reveal Step 5
      .to("#step-5", {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out"
      }, "-=0.25")

      // Final Crash: Fall off Step 5 onto the ground and land perfectly flat & centered
      .to("#phone-wrapper", {
        x: 0,
        y: 0,
        scale: 1.45, /* Fills enough of the frame comfortably */
        duration: 0.9,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        duration: 0.9,
        ease: "power2.in"
      }, "<")
      // Impact! Hit the ground, screen cracks on impact
      .to("#phone-cracks", { 
        opacity: 1, 
        duration: 0.05 
      }, "<")
      // Recoil & Shake on impact
      .to("#phone-wrapper", { y: "-2vh", duration: 0.1, ease: "power1.out" })
      .to("#phone-wrapper", { y: 0, duration: 0.1, ease: "power1.in" })
      .to("#phone-wrapper", { x: "+=10", y: "-=5", duration: 0.05, yoyo: true, repeat: 4 })
      // Shock text reveal
      .to("#shock-text", { 
        autoAlpha: 1, 
        y: 0, 
        duration: 1.2, 
        ease: "back.out(1.5)" 
      }, "-=0.4")

    // --- SCENE 4: SOLUTION REVEAL (0.65 to 0.85) ---
    masterTL
      .to("#scene-3", { 
        autoAlpha: 0, 
        duration: 0.8 
      })
      .to("#phone-wrapper", { 
        autoAlpha: 0, 
        duration: 0.8 
      }, "<")
      .to(".viewport", { 
        backgroundColor: "#ffffff", 
        duration: 0.8 
      }, "<")
      .to("#scene-4", { 
        autoAlpha: 1, 
        duration: 0.4 
      }, "-=0.4")
      // Spreading sunlight animation
      .to(".sunlight-beam", {
        scale: 25,
        duration: 1.5,
        ease: "power3.out"
      }, "-=0.6")
      // Header text slide up
      .from(".solution-header", { 
        y: 40, 
        opacity: 0, 
        duration: 1, 
        ease: "power2.out" 
      })
      // Cards deck snap and grid reveal
      .to(cards, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        stagger: 0.15,
        duration: 1.5,
        ease: "power3.out"
      }, "-=0.6")
      // Legibility fade inside cards
      .to(".card-content", { 
        opacity: 1, 
        stagger: 0.1, 
        duration: 0.8 
      }, "-=0.8")

    // --- SCENE 5: FINAL CTA FRAME (0.85 to 1.0) ---
    masterTL
      .to("#scene-4", { 
        autoAlpha: 0, 
        duration: 0.8 
      })
      // Fade back in the classroom skeleton background with dimmed lighting
      .to(".classroom-container-scene5", {
        opacity: 1,
        duration: 0.8
      }, "<")
      .to(".viewport", { 
        backgroundColor: "#07050e", 
        duration: 0.8 
      }, "<")
      .to("#scene-5", { 
        autoAlpha: 1, 
        duration: 0.4 
      }, "-=0.4")
      
      // Popup 6 WebP objects (precise positions mapped via CSS)
      .to(".obj-tower", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=0.4")
      .to(".obj-dish", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")
      .to(".obj-router", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")
      .to(".obj-cables", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")
      .to(".obj-mobile", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")
      .to(".obj-sim", { opacity: 1, scale: 1, y: 0, duration: 1.2, ease: "back.out(1.15)" }, "-=1.0")

      // CTA Content pop
      .to(".cta-box", { 
        opacity: 1, 
        scale: 1, 
        duration: 1.2, 
        ease: "power2.out" 
      }, "-=1.0")

    // Trigger an initial refresh of ScrollTrigger configurations to compute dimensions correctly
    ScrollTrigger.refresh()
  }

  // Handle Video Loading before creating timeline
  if (zoomVideo) {
    if (zoomVideo.readyState >= 1) {
      initTimeline();
    } else {
      zoomVideo.addEventListener('loadedmetadata', initTimeline);
    }
  } else {
    console.error("Zoom video element not found!");
  }

  // Scroll debugging listener
  window.addEventListener('scroll', () => {
    console.log("Aether ScrollPosition:", window.scrollY);
  });
})
