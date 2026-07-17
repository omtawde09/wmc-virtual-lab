'use client';

import { ReactNode, useState, useRef, useEffect, useCallback } from 'react';

type IPhoneMockupProps = {
    children: ReactNode;
    /** Optional scale for the device (default: 1) */
    scale?: number;
    /** Optional class name for the wrapper */
    className?: string;
};

// Rotation limits in degrees
const ROTATION_LIMITS = {
    minY: -25,  // Left rotation limit
    maxY: 15,   // Right rotation limit
    minX: -8,   // Up rotation limit
    maxX: 12,   // Down rotation limit
};

// Base rotation (default view angle)
const BASE_ROTATION = {
    x: 2,
    y: -12,
};

/**
 * Premium CSS-based 3D iPhone Mockup with interactive rotation
 * 
 * Features:
 * - Subtle auto-rotation animation
 * - User-controlled rotation via mouse/touch drag
 * - Rotation bounded within limits
 * - Realistic lighting and shadows
 * - Dynamic Island indicator
 */
export function IPhoneMockup({ children, scale = 1, className = '' }: IPhoneMockupProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const screenRef = useRef<HTMLDivElement>(null);
    const [rotation, setRotation] = useState({ x: BASE_ROTATION.x, y: BASE_ROTATION.y });
    const [isDragging, setIsDragging] = useState(false);
    const [autoRotatePhase, setAutoRotatePhase] = useState(0);
    const dragStart = useRef({ x: 0, y: 0, rotX: 0, rotY: 0 });

    // Auto-rotation animation (subtle oscillation when not dragging)
    useEffect(() => {
        if (isDragging) return;

        const animate = () => {
            setAutoRotatePhase((prev) => prev + 0.022);
        };

        const interval = setInterval(animate, 16); // ~60fps
        return () => clearInterval(interval);
    }, [isDragging]);

    // Calculate auto-rotation offset
    const autoRotateOffset = isDragging ? 0 : Math.sin(autoRotatePhase) * 9;

    // Clamp rotation within limits
    const clampRotation = useCallback((x: number, y: number) => {
        return {
            x: Math.max(ROTATION_LIMITS.minX, Math.min(ROTATION_LIMITS.maxX, x)),
            y: Math.max(ROTATION_LIMITS.minY, Math.min(ROTATION_LIMITS.maxY, y)),
        };
    }, []);

    // Handle pointer/touch start
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        // Only handle primary button (left click) or touch
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        const target = e.target as HTMLElement | null;

        // Check if click is on or within an interactive element
        if (target?.closest('[data-iphone-interactive="true"]')) return;

        // Check if click is within screen area (redundant but safe)
        if (screenRef.current && target && screenRef.current.contains(target)) return;

        // Additional check: if target is a button or interactive element
        if (target?.closest('button, a, input, select, textarea, [role="button"]')) return;

        setIsDragging(true);
        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            rotX: rotation.x,
            rotY: rotation.y,
        };

        // Capture pointer for smooth dragging outside element
        e.currentTarget.setPointerCapture(e.pointerId);
    }, [rotation]);

    // Handle pointer/touch move
    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStart.current.x;
        const deltaY = e.clientY - dragStart.current.y;

        // Convert pixel movement to rotation degrees (adjust sensitivity)
        const sensitivity = 0.3;
        const newRotY = dragStart.current.rotY + deltaX * sensitivity;
        const newRotX = dragStart.current.rotX - deltaY * sensitivity * 0.5;

        setRotation(clampRotation(newRotX, newRotY));
    }, [isDragging, clampRotation]);

    // Handle pointer/touch end
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        setIsDragging(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    }, []);

    // Smooth return to base rotation when not dragging
    useEffect(() => {
        if (isDragging) return;

        const returnToBase = () => {
            setRotation((prev) => {
                const dx = BASE_ROTATION.x - prev.x;
                const dy = BASE_ROTATION.y - prev.y;

                // If close enough, snap to base
                if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                    return BASE_ROTATION;
                }

                // Ease back to base rotation
                return {
                    x: prev.x + dx * 0.05,
                    y: prev.y + dy * 0.05,
                };
            });
        };

        const interval = setInterval(returnToBase, 16);
        return () => clearInterval(interval);
    }, [isDragging]);

    // Final rotation values with auto-rotate
    const finalRotation = {
        x: rotation.x,
        y: rotation.y + autoRotateOffset,
    };

    return (
        <div
            ref={containerRef}
            className={`iphone-3d-wrapper select-none ${className}`}
            style={{
                perspective: '1200px',
                perspectiveOrigin: '50% 50%',
                width: `${360 * scale}px`,
                height: `${800 * scale}px`,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div
                className="iphone-3d-device transition-transform text-left"
                style={{
                    transform: `rotateY(${finalRotation.y}deg) rotateX(${finalRotation.x}deg) scale(${scale})`,
                    transformStyle: 'preserve-3d',
                    transitionDuration: isDragging ? '0ms' : '100ms',
                    width: '360px',
                    height: '800px',
                    transformOrigin: 'center center',
                }}
            >
                {/* Outer device frame - black titanium look */}
                <div className="relative rounded-[52px] p-[12px] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.6),0_30px_60px_-30px_rgba(0,0,0,0.5)] bg-gradient-to-br from-[#1a1a1a] via-[#2d2d2d] to-[#1a1a1a] pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>

                    {/* Metallic edge highlight (left side catches light) */}
                    <div
                        className="absolute inset-0 rounded-[52px] pointer-events-none"
                        style={{
                            background: 'linear-gradient(105deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 20%, transparent 40%, transparent 60%, rgba(0,0,0,0.2) 100%)',
                        }}
                    />

                    {/* Inner bezel - slightly lighter */}
                    <div className="relative rounded-[42px] p-[3px] bg-gradient-to-br from-[#252525] to-[#1f1f1f] pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>

                        {/* Screen bezel inner edge */}
                        <div className="relative rounded-[40px] overflow-hidden bg-[#0a0a0a] shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] pointer-events-none" style={{ transformStyle: 'preserve-3d' }}>

                            {/* Dynamic Island / Notch area */}
                            <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pt-[10px] pointer-events-none">
                                <div className="w-[120px] h-[34px] bg-black rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                                    {/* Camera dot */}
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ml-[30px]">
                                        <div className="w-[11px] h-[11px] rounded-full bg-gradient-to-br from-[#1a1a2e] to-[#0a0a12] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                                            <div className="w-[5px] h-[5px] rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#0d1f2d] absolute top-[3px] left-[3px]" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Screen content area */}
                            <div
                                ref={screenRef}
                                className="relative h-[700px] rounded-[38px] overflow-hidden bg-white"
                                style={{
                                    transform: 'translateZ(4px)',
                                    backfaceVisibility: 'hidden',
                                    touchAction: 'manipulation',
                                }}
                                onPointerDown={(e) => e.stopPropagation()} // Allow interactions inside screen
                                onClick={(e) => e.stopPropagation()}
                                data-iphone-interactive="true"
                            >
                                <div className="pointer-events-auto h-full w-full overflow-hidden">
                                    {/* Glass reflection info screen */}
                                    <div
                                        className="absolute inset-0 pointer-events-none z-10"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 40%)',
                                        }}
                                    />
                                    {children}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Side buttons - Volume buttons (left side) */}
                    <div
                        className="absolute left-[-3px] top-[120px] w-[4px] h-[30px] rounded-l-[2px] bg-gradient-to-r from-[#2a2a2a] to-[#1a1a1a]"
                        style={{
                            boxShadow: '-1px 0 2px rgba(0,0,0,0.3)',
                        }}
                    />
                    <div
                        className="absolute left-[-3px] top-[160px] w-[4px] h-[55px] rounded-l-[2px] bg-gradient-to-r from-[#2a2a2a] to-[#1a1a1a]"
                        style={{
                            boxShadow: '-1px 0 2px rgba(0,0,0,0.3)',
                        }}
                    />
                    <div
                        className="absolute left-[-3px] top-[225px] w-[4px] h-[55px] rounded-l-[2px] bg-gradient-to-r from-[#2a2a2a] to-[#1a1a1a]"
                        style={{
                            boxShadow: '-1px 0 2px rgba(0,0,0,0.3)',
                        }}
                    />

                    {/* Power button (right side) */}
                    <div
                        className="absolute right-[-3px] top-[170px] w-[4px] h-[80px] rounded-r-[2px] bg-gradient-to-l from-[#2a2a2a] to-[#1a1a1a]"
                        style={{
                            boxShadow: '1px 0 2px rgba(0,0,0,0.3)',
                        }}
                    />
                </div>

                {/* 3D depth shadow effect */}
                <div
                    className="absolute inset-0 rounded-[52px] -z-10"
                    style={{
                        transform: 'translateZ(-10px) translateX(5px) translateY(3px)',
                        background: 'rgba(0,0,0,0.15)',
                        filter: 'blur(15px)',
                    }}
                />
            </div>
        </div>
    );
}
