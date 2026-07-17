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
  
  // Virtual scrub progress lerp variables to eliminate scrolling stutter
  let targetTime = 0;
  let duration = 6.4;
  
  function smoothVideoScrub() {
    if (zoomVideo && zoomVideo.readyState >= 1) {
      const diff = targetTime - zoomVideo.currentTime;
      if (Math.abs(diff) > 0.002) {
        // Smoothly glide to the target time (8% catch-up rate per tick)
        zoomVideo.currentTime = Math.max(0, Math.min(duration, zoomVideo.currentTime + diff * 0.08));
      }
    }
    requestAnimationFrame(smoothVideoScrub);
  }
  requestAnimationFrame(smoothVideoScrub);
  
  const initTimeline = () => {
    duration = zoomVideo.duration || 6.4;
    console.log("Scrubbing zoom video duration:", duration);
    
    const videoProgressObj = { progress: 0 };
    
    // Master Cinematic Scroll Timeline
    const masterTL = gsap.timeline({
      scrollTrigger: {
        trigger: "#scroll-container",
        start: "top top",
        end: "bottom bottom",
        scrub: 1.5, // smooth scrubbing duration
        pin: ".viewport",
        anticipatePin: 1
      }
    })

    // Build Timeline Choreography

    // --- SCENE 1: OPENING ATMOSPHERE -> CAMERA PUSH (0.0 to 0.20) ---
    masterTL
      .to(".title-overlay", { 
        y: -80, 
        opacity: 0, 
        duration: 1.2, 
        ease: "power2.inOut" 
      })
      .to(".classroom-container", { 
        opacity: 0, 
        duration: 1.2 
      }, "<")
      .to(".zoom-video-container", { 
        opacity: 1, 
        duration: 1.2 
      }, "<")
      .to("#scene-1", { 
        autoAlpha: 0, 
        duration: 1 
      })

    // --- SCENE 2: CAMERA PUSH TO PHONE (0.20 to 0.42) ---
    masterTL
      .to("#scene-2", { 
        autoAlpha: 1, 
        duration: 0.1 
      }, "-=0.8")
      // Play / scrub the camera zoom video using virtual progress lerp
      .to(videoProgressObj, {
        progress: 1,
        ease: "none",
        duration: 3,
        onUpdate: () => {
          targetTime = videoProgressObj.progress * duration;
        }
      }, "-=0.8")
      // Seamlessly transition from video phone to CSS 3D phone model
      .to("#phone-wrapper", { 
        opacity: 1, 
        scale: 1, 
        y: 0, 
        duration: 1, 
        ease: "power2.out" 
      }, "-=0.8")
      .to(".zoom-video-container", { 
        opacity: 0, 
        duration: 0.8 
      }, "-=0.6")
      // Staggered reveal of chat messages
      .to("#msg-1", { 
        opacity: 1, 
        y: 0, 
        duration: 0.8, 
        ease: "power1.out" 
      }, "-=0.2")
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
      
      // Step 1: Hit, bounce, then reveal
      .to("#phone-wrapper", {
        x: "12vw",
        y: "-32vh",
        scale: 0.65,
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
      // Bounce recoil 1 (still invisible)
      .to("#phone-wrapper", { y: "-35vh", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationX: 95, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "-32vh", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationX: 110, duration: 0.15, ease: "power1.in" }, "<")
      // Reveal Step 1
      .to("#step-1", {
        opacity: 1,
        duration: 0.35,
        ease: "power2.out"
      }, "-=0.35")

      // Step 2: Hit, bounce, then reveal
      .to("#phone-wrapper", {
        x: "-1vw",
        y: "-18vh",
        scale: 0.74,
        duration: 0.7,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 55,
        rotationY: -10,
        rotationZ: -18,
        duration: 0.7,
        ease: "power2.in"
      }, "<")
      // Bounce recoil 2 (still invisible)
      .to("#phone-wrapper", { y: "-21vh", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationY: -20, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "-18vh", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationY: -10, duration: 0.15, ease: "power1.in" }, "<")
      // Reveal Step 2
      .to("#step-2", {
        opacity: 1,
        duration: 0.35,
        ease: "power2.out"
      }, "-=0.35")

      // Step 3: Hit, bounce, then reveal
      .to("#phone-wrapper", {
        x: "-13vw",
        y: "-2vh",
        scale: 0.83,
        duration: 0.7,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 35,
        rotationY: -5,
        rotationZ: -24,
        duration: 0.7,
        ease: "power2.in"
      }, "<")
      // Bounce recoil 3 (still invisible)
      .to("#phone-wrapper", { y: "-5vh", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationX: 45, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "-2vh", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationX: 35, duration: 0.15, ease: "power1.in" }, "<")
      // Reveal Step 3
      .to("#step-3", {
        opacity: 1,
        duration: 0.35,
        ease: "power2.out"
      }, "-=0.35")

      // Step 4: Hit, bounce, then reveal
      .to("#phone-wrapper", {
        x: "-23vw",
        y: "14vh",
        scale: 0.92,
        duration: 0.7,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 15,
        rotationY: 0,
        rotationZ: -30,
        duration: 0.7,
        ease: "power2.in"
      }, "<")
      // Bounce recoil 4 (still invisible)
      .to("#phone-wrapper", { y: "11vh", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationY: 10, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "14vh", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationY: 0, duration: 0.15, ease: "power1.in" }, "<")
      // Reveal Step 4
      .to("#step-4", {
        opacity: 1,
        duration: 0.35,
        ease: "power2.out"
      }, "-=0.35")

      // Step 5: Final Impact & Screen Crack
      .to("#phone-wrapper", {
        x: "-30vw",
        y: "30vh",
        scale: 1.0,
        duration: 0.8,
        ease: "power2.in"
      })
      .to("#phone-element", {
        rotationX: 5,
        rotationY: -5,
        rotationZ: -36,
        duration: 0.8,
        ease: "power2.in"
      }, "<")
      // Impact recoil 5 (rebound up)
      .to("#phone-wrapper", { y: "27vh", duration: 0.15, ease: "power1.out" })
      .to("#phone-element", { rotationX: -5, duration: 0.15, ease: "power1.out" }, "<")
      .to("#phone-wrapper", { y: "30vh", duration: 0.15, ease: "power1.in" })
      .to("#phone-element", { rotationX: 5, duration: 0.15, ease: "power1.in" }, "<")
      // Screen crack triggers on impact
      .to("#phone-cracks", { opacity: 1, duration: 0.1 }, "<")
      // Reveal Step 5
      .to("#step-5", {
        opacity: 1,
        duration: 0.35,
        ease: "power2.out"
      }, "-=0.25")
      // Impact shake
      .to("#phone-wrapper", { x: "+=12", y: "-=6", duration: 0.05, yoyo: true, repeat: 4 })
      // Text reveal
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
