'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { IPhoneMockup } from './IPhoneMockup';

// ----------------------------------------------------------------------------
// Types & Data (Hardcoded from homeDataEn.ts for standalone demo)
// ----------------------------------------------------------------------------

type DemoTab = {
    id: string;
    label: string;
    icon: string;
    slides: { id: string; image: { src: string; alt: string } }[];
};

type DemoDemo = {
    statusBar: { time: string };
    topBar: { credits: string; tier: string };
    tabs: DemoTab[];
    overlayActions: {
        primary: { icon: string; label: string };
        secondary: { icon: string; label: string };
    };
    optionCards: { id: string; title: string; subtitle: string; icon?: string }[];
    selections: {
        roomType: string;
        roomStyle: string;
        colorTheme: string;
    };
    modals: {
        roomType: { title: string; options: { id: string; label: string; enabled: boolean }[] };
        roomStyle: { title: string; options: { id: string; label: string; enabled: boolean }[] };
        colorTheme: { title: string; options: { id: string; label: string; swatch: string; enabled: boolean }[] };
    };
    timing: { generateDelayMs: number };
    resultsPage: {
        eyebrow: string;
        title: string;
        subtitle: string;
        cta: { label: string };
    };
    results: { id: string; label: string; image: string }[];
    primaryAction: { label: string };
    nav: { items: { id: string; label: string; icon: string; badge?: boolean }[] };
    toasts: {
        navigation: string;
        generate: string;
        apply: string;
        back: string;
        pro: string;
        reset: string;
    };
    autoPlayMs?: number;
};

const DEMO_DATA: DemoDemo = {
    statusBar: { time: '9:41' },
    topBar: { credits: '7503', tier: 'PRO' },
    tabs: [
        {
            id: 'transform',
            label: 'Transform',
            icon: 'auto_awesome',
            slides: [
                { id: 'transform-1', image: { src: '/demo-assets/input-room.webp', alt: 'Original Room' } },
                { id: 'transform-2', image: { src: '/home/demo/screen-2.svg', alt: 'Transform preview 2' } },
                { id: 'transform-3', image: { src: '/home/demo/screen-3.svg', alt: 'Transform preview 3' } },
            ],
        },
        {
            id: 'decorator',
            label: 'Decorator',
            icon: 'design_services',
            slides: [
                { id: 'decorator-1', image: { src: '/home/demo/screen-2.svg', alt: 'Decorator preview 1' } },
                { id: 'decorator-2', image: { src: '/home/demo/screen-3.svg', alt: 'Decorator preview 2' } },
                { id: 'decorator-3', image: { src: '/home/demo/screen-1.svg', alt: 'Decorator preview 3' } },
            ],
        },
        {
            id: 'cleaner',
            label: 'Cleaner',
            icon: 'cleaning_services',
            slides: [
                { id: 'cleaner-1', image: { src: '/home/demo/screen-3.svg', alt: 'Cleaner preview 1' } },
                { id: 'cleaner-2', image: { src: '/home/demo/screen-1.svg', alt: 'Cleaner preview 2' } },
                { id: 'cleaner-3', image: { src: '/home/demo/screen-2.svg', alt: 'Cleaner preview 3' } },
            ],
        },
        {
            id: 'animate',
            label: 'Animate',
            icon: 'movie',
            slides: [
                { id: 'animate-1', image: { src: '/home/demo/screen-2.svg', alt: 'Animate preview 1' } },
                { id: 'animate-2', image: { src: '/home/demo/screen-1.svg', alt: 'Animate preview 2' } },
                { id: 'animate-3', image: { src: '/home/demo/screen-3.svg', alt: 'Animate preview 3' } },
            ],
        },
    ],
    overlayActions: {
        primary: { icon: 'auto_awesome', label: 'Apply' },
        secondary: { icon: 'close', label: 'Reset' },
    },
    optionCards: [
        { id: 'room-type', title: 'Room Type', subtitle: 'Living Room', icon: 'meeting_room' },
        { id: 'room-style', title: 'Room Style', subtitle: 'Bohemian', icon: 'palette' },
        { id: 'color-theme', title: 'Color Style', subtitle: 'Teal', icon: 'palette' },
    ],
    selections: {
        roomType: 'living-room',
        roomStyle: 'bohemian',
        colorTheme: 'teal',
    },
    modals: {
        roomType: {
            title: 'Select Room Type',
            options: [
                { id: 'living-room', label: 'Living Room', enabled: true },
                { id: 'bedroom', label: 'Bedroom', enabled: false },
                { id: 'kitchen', label: 'Kitchen', enabled: false },
                { id: 'office', label: 'Office', enabled: false },
            ],
        },
        roomStyle: {
            title: 'Select Room Style',
            options: [
                { id: 'bohemian', label: 'Bohemian', enabled: true },
                { id: 'modern', label: 'Modern', enabled: false },
                { id: 'industrial', label: 'Industrial', enabled: false },
                { id: 'scandi', label: 'Scandinavian', enabled: false },
                { id: 'boho', label: 'Boho', enabled: false },
            ],
        },
        colorTheme: {
            title: 'Select Color Theme',
            options: [
                { id: 'teal', label: 'Teal', swatch: '#3B9DA6', enabled: true },
                { id: 'yellow', label: 'Yellow', swatch: '#F4B84A', enabled: false },
                { id: 'blue', label: 'Blue', swatch: '#5A89F2', enabled: false },
                { id: 'green', label: 'Green', swatch: '#7DBF5E', enabled: false },
                { id: 'pink', label: 'Pink', swatch: '#F18DA7', enabled: false },
            ],
        },
    },
    timing: {
        generateDelayMs: 2500,
    },
    resultsPage: {
        eyebrow: 'Render Complete',
        title: 'Your Design Variations',
        subtitle: 'Browse curated results based on your selection.',
        cta: { label: 'Open Full Results' },
    },
    results: [
        { id: 'result-1', label: 'Original Room', image: '/demo-assets/input-room.webp' },
        { id: 'result-2', label: 'Redesigned Room', image: '/demo-assets/output-room.jpg' },
        { id: 'result-3', label: 'Variation', image: '/home/demo/screen-3.svg' },
    ],
    primaryAction: { label: 'Generate' },
    nav: {
        items: [
            { id: 'generate', label: 'Generate', icon: 'auto_awesome' },
            { id: 'explore', label: 'Explore', icon: 'explore' },
            { id: 'boards', label: 'My Boards', icon: 'grid_view' },
            { id: 'account', label: 'Account', icon: 'person' },
        ],
    },
    toasts: {
        navigation: 'Navigate to',
        generate: 'Generating your design...',
        apply: 'Style applied',
        back: 'Back',
        pro: 'Pro plan',
        reset: 'Reset',
    },
};

type Toast = {
    id: number;
    message: string;
};

type DemoModalKind = 'roomType' | 'roomStyle' | 'colorTheme';

// ----------------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------------

export function IPhoneMockupDemo() {
    const demo = DEMO_DATA;
    const [activeTabId, setActiveTabId] = useState(demo.tabs[0]?.id ?? '');
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeNavId, setActiveNavId] = useState(demo.nav.items[0]?.id ?? '');
    const [toast, setToast] = useState<Toast | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [activeModal, setActiveModal] = useState<DemoModalKind | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const getDefaultSelection = (kind: DemoModalKind) => {
        if (demo.selections?.[kind]) return demo.selections[kind];
        const options = demo.modals?.[kind]?.options ?? [];
        return options.find((option) => option.enabled !== false)?.id ?? options[0]?.id ?? '';
    };
    const [selectedRoomType, setSelectedRoomType] = useState(() => getDefaultSelection('roomType'));
    const [selectedRoomStyle, setSelectedRoomStyle] = useState(() => getDefaultSelection('roomStyle'));
    const [selectedColorTheme, setSelectedColorTheme] = useState(() => getDefaultSelection('colorTheme'));

    const activeTab = useMemo(
        () => demo.tabs.find((tab) => tab.id === activeTabId) ?? demo.tabs[0],
        [demo.tabs, activeTabId]
    );

    const slides = activeTab?.slides ?? [];
    const activeSlide = slides[activeIndex] ?? slides[0];

    const selectionLabels = useMemo(() => {
        const modals = demo.modals;
        const getLabel = (options: { id: string; label: string }[], id: string) =>
            options.find((option) => option.id === id)?.label ?? id;
        const roomType = getLabel(modals.roomType.options, selectedRoomType);
        const roomStyle = getLabel(modals.roomStyle.options, selectedRoomStyle);
        const colorOption = modals.colorTheme.options.find((option) => option.id === selectedColorTheme);
        return {
            roomType,
            roomStyle,
            colorTheme: colorOption?.label ?? selectedColorTheme,
            colorThemeSwatch: colorOption?.swatch,
        };
    }, [demo.modals, selectedRoomType, selectedRoomStyle, selectedColorTheme]);

    const showToast = (message: string) => {
        setToast({ id: Date.now(), message });
    };

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 1500);
        return () => window.clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        setActiveIndex(0);
    }, [activeTabId]);

    useEffect(() => {
        if (!demo.autoPlayMs || isPaused || slides.length <= 1) return;
        const timer = window.setTimeout(() => {
            setActiveIndex((current) => (current + 1) % slides.length);
        }, demo.autoPlayMs);
        return () => window.clearTimeout(timer);
    }, [demo.autoPlayMs, isPaused, slides.length, activeIndex]);

    if (!activeTab || !activeSlide) return null;

    const handleImageTap = () => {
        if (slides.length <= 1) return;
        setActiveIndex((current) => (current + 1) % slides.length);
    };

    const handleNavClick = (item: typeof demo.nav.items[number]) => {
        setActiveNavId(item.id);
        if (demo.toasts?.navigation) {
            showToast(`${demo.toasts.navigation} ${item.label}`);
        }
    };

    const handleGenerate = () => {
        if (isGenerating) return;
        setIsGenerating(true);
        showToast(demo.toasts?.generate ?? demo.primaryAction.label);
        const delayMs = demo.timing?.generateDelayMs ?? 1200;
        window.setTimeout(() => {
            setShowResults(true);
            setIsGenerating(false);
        }, delayMs);
    };

    // Preload results images
    useEffect(() => {
        if (!demo.results?.length) return;
        demo.results.forEach((result) => {
            const image = new window.Image();
            image.src = result.image;
        });
    }, [demo.results]);

    const screenContent = (
        <div className="relative flex min-h-[590px] h-full flex-col bg-[#f7f6fb] px-4 py-4 font-sans">
            {toast ? (
                <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-full bg-[#3f1aa8] px-3 py-1 text-[11px] font-semibold text-white shadow-lg whitespace-nowrap">
                    {toast.message}
                </div>
            ) : null}

            <StatusBar time={demo.statusBar.time} />

            <div className="flex flex-1 flex-col overflow-hidden">
                {showResults ? (
                    <ResultsView
                        results={demo.results ?? []}
                        meta={demo.resultsPage}
                        onBack={() => setShowResults(false)}
                    />
                ) : (
                    <>
                        <TopBar
                            credits={demo.topBar.credits}
                            tier={demo.topBar.tier}
                            onTierClick={() => showToast(demo.toasts?.pro ?? demo.topBar.tier)}
                        />

                        <SegmentedControl tabs={demo.tabs} activeTabId={activeTabId} onChange={setActiveTabId} />

                        <HeroImage
                            slide={activeSlide}
                            isFirstSlide={activeIndex === 0}
                            overlayPrimary={demo.overlayActions.primary}
                            overlaySecondary={demo.overlayActions.secondary}
                            onApply={() => showToast(demo.toasts?.apply ?? demo.overlayActions.primary.label)}
                            onReset={() => showToast(demo.toasts?.reset ?? demo.overlayActions.secondary.label)}
                            onInteract={handleImageTap}
                            onPointerEnter={() => setIsPaused(true)}
                            onPointerLeave={() => setIsPaused(false)}
                        />

                        <OptionCards
                            cards={demo.optionCards}
                            selections={selectionLabels}
                            onOpen={(id) => {
                                if (id === 'room-type') setActiveModal('roomType');
                                if (id === 'room-style') setActiveModal('roomStyle');
                                if (id === 'color-theme') setActiveModal('colorTheme');
                            }}
                        />

                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerDownCapture={(e) => e.stopPropagation()}
                            data-iphone-interactive="true"
                            className="mt-3 w-full rounded-full bg-[#3f1aa8] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(63,26,168,0.35)] transition hover:bg-[#35138d] disabled:opacity-70"
                        >
                            {isGenerating ? 'Generating...' : demo.primaryAction.label}
                        </button>

                        {activeModal ? (
                            <SelectionModal
                                kind={activeModal}
                                data={demo.modals[activeModal]}
                                value={
                                    activeModal === 'roomType'
                                        ? selectedRoomType
                                        : activeModal === 'roomStyle'
                                            ? selectedRoomStyle
                                            : selectedColorTheme
                                }
                                onClose={() => setActiveModal(null)}
                                onSelect={(id) => {
                                    if (activeModal === 'roomType') setSelectedRoomType(id);
                                    if (activeModal === 'roomStyle') setSelectedRoomStyle(id);
                                    if (activeModal === 'colorTheme') setSelectedColorTheme(id);
                                    setActiveModal(null);
                                }}
                            />
                        ) : null}
                    </>
                )}
            </div>

            <BottomNav
                items={demo.nav.items}
                activeId={activeNavId}
                onChange={handleNavClick}
                className={cn('transition-transform duration-500 ease-in-out', showResults ? 'translate-y-[120px]' : 'translate-y-0')}
            />
        </div>
    );

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100 p-8">
            <IPhoneMockup>{screenContent}</IPhoneMockup>
        </div>
    );
}

// ----------------------------------------------------------------------------
// Sub-Components
// ----------------------------------------------------------------------------

function StatusBar({ time }: { time: string }) {
    return (
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#6a6a7a] mb-1">
            <span>{time}</span>
            <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-base leading-none">signal_cellular_alt</span>
                <span className="material-symbols-outlined text-base leading-none">wifi</span>
                <span className="material-symbols-outlined text-base leading-none">battery_full</span>
            </div>
        </div>
    );
}

function TopBar({ credits, tier, onTierClick }: { credits: string; tier: string; onTierClick: () => void }) {
    return (
        <div className="mt-2 flex items-center justify-between" data-iphone-interactive="true">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#3c3c46]">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f1a94b] text-white">
                    <span className="material-symbols-outlined text-sm leading-none">paid</span>
                </span>
                {credits}
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm overflow-hidden">
                <img src="/demo-assets/app-icon.png" alt="Styly" className="h-full w-full object-cover" />
            </div>
            <button
                type="button"
                onClick={onTierClick}
                className="rounded-full bg-[#3f1aa8] px-3 py-1 text-[11px] font-semibold text-white shadow-sm"
            >
                {tier}
            </button>
        </div>
    );
}

function SegmentedControl({ tabs, activeTabId, onChange }: { tabs: DemoTab[]; activeTabId: string; onChange: (id: string) => void }) {
    return (
        <div className="mt-3 flex items-center gap-1 rounded-full bg-[#eceaf4] p-1 text-[11px] font-semibold text-[#7a7a8a]" data-iphone-interactive="true">
            {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            'flex items-center gap-1 rounded-full px-2.5 py-1.5 transition flex-1 justify-center',
                            isActive ? 'bg-[#3f1aa8] text-white shadow-sm' : 'hover:text-[#3f1aa8]'
                        )}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                    >
                        <span className="material-symbols-outlined text-sm leading-none">{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function HeroImage({
    slide,
    isFirstSlide,
    overlayPrimary,
    overlaySecondary,
    onApply,
    onReset,
    onInteract,
    onPointerEnter,
    onPointerLeave,
}: {
    slide: { image: { src: string; alt: string } };
    isFirstSlide: boolean;
    overlayPrimary: { icon: string; label: string };
    overlaySecondary: { icon: string; label: string };
    onApply: () => void;
    onReset: () => void;
    onInteract: () => void;
    onPointerEnter: () => void;
    onPointerLeave: () => void;
}) {
    return (
        <div
            className="mt-3 overflow-hidden rounded-[22px] bg-white shadow-[0_12px_24px_rgba(90,86,120,0.18)]"
            onClick={onInteract}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            role="button"
            tabIndex={0}
            data-iphone-interactive="true"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerDownCapture={(e) => e.stopPropagation()}
        >
            <div className="relative">
                <div
                    aria-label={slide.image.alt}
                    className="h-[210px] w-full rounded-[18px] bg-gradient-to-br from-[#f3f0ff] via-[#f7f6fb] to-[#fef2eb] bg-cover bg-center"
                    style={{ backgroundImage: `url(${slide.image.src})` }}
                />
                <div className="absolute right-3 top-3 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onApply();
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#3f1aa8] shadow-md hover:scale-105 transition-transform"
                    >
                        <span className="material-symbols-outlined text-base leading-none">{overlayPrimary.icon}</span>
                    </button>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onReset();
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#3f1aa8] shadow-md hover:scale-105 transition-transform"
                    >
                        <span className="material-symbols-outlined text-base leading-none">{overlaySecondary.icon}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function OptionCards({ cards, selections, onOpen }: { cards: any[]; selections: any; onOpen: (id: string) => void }) {
    return (
        <div className="mt-3 grid grid-cols-2 gap-3" data-iphone-interactive="true">
            {cards.map((card: any) => (
                <button
                    key={card.id}
                    type="button"
                    onClick={() => onOpen(card.id)}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerDownCapture={(event) => event.stopPropagation()}
                    className={cn(
                        'w-full rounded-2xl border border-[#eceaf4] bg-white px-3 py-4 text-center shadow-[0_10px_20px_rgba(90,86,120,0.08)] transition',
                        card.id === 'color-theme'
                            ? 'col-span-2 flex items-center justify-between gap-3 px-4 py-3'
                            : 'flex flex-col items-center justify-center hover:border-[#d8d6e4]'
                    )}
                >
                    {card.id === 'color-theme' ? (
                        <>
                            <div className="flex items-center gap-3 text-left pointer-events-none">
                                <span
                                    className="h-4 w-4 rounded-full border border-[#e1dff0]"
                                    style={{ backgroundColor: selections.colorThemeSwatch ?? '#f1a94b' }}
                                />
                                <div>
                                    <p className="text-sm font-semibold text-[#3c3c46]">{card.title}</p>
                                    <p className="text-[11px] text-[#9a9aa6]">{selections.colorTheme}</p>
                                </div>
                            </div>
                            {card.icon ? (
                                <span className="material-symbols-outlined text-lg text-[#3f1aa8] pointer-events-none">{card.icon}</span>
                            ) : null}
                        </>
                    ) : (
                        <>
                            {card.icon ? (
                                <span className="material-symbols-outlined text-lg text-[#3f1aa8]">{card.icon}</span>
                            ) : null}
                            <p className="mt-1 text-sm font-semibold text-[#3c3c46]">{card.title}</p>
                            <p className="text-[11px] text-[#9a9aa6]">
                                {card.id === 'room-type'
                                    ? selections.roomType
                                    : card.id === 'room-style'
                                        ? selections.roomStyle
                                        : card.subtitle}
                            </p>
                        </>
                    )}
                </button>
            ))}
        </div>
    );
}

function SelectionModal({ kind, data, value, onSelect, onClose }: { kind: DemoModalKind; data: any; value: string; onSelect: (id: string) => void; onClose: () => void }) {
    const gridClass = cn(
        'mt-4 grid gap-3',
        kind === 'roomType' ? 'grid-cols-2' : 'grid-cols-4'
    );

    return (
        <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-[28px] bg-[rgba(22,20,34,0.45)] px-3"
            onClick={onClose}
            data-iphone-interactive="true"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerDownCapture={(e) => e.stopPropagation()}
        >
            <div
                className="w-full max-w-[290px] rounded-3xl bg-white px-4 pb-4 pt-3 text-[#2d2b33] shadow-[0_20px_45px_rgba(17,16,25,0.35)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1eff7] text-[#6b6876]"
                    >
                        <span className="material-symbols-outlined text-base leading-none">close</span>
                    </button>
                    <p className="text-sm font-semibold">{data.title}</p>
                    <span className="h-7 w-7" aria-hidden />
                </div>
                <div className={gridClass}>
                    {data.options.map((option: any) => {
                        const isSelected = option.id === value;
                        const isEnabled = option.enabled !== false;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                disabled={!isEnabled}
                                onClick={() => {
                                    if (!isEnabled) return;
                                    onSelect(option.id);
                                }}
                                className={cn(
                                    'flex flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center text-[11px] font-semibold transition',
                                    isSelected
                                        ? 'border-[#3f1aa8] bg-[#f4f1ff] text-[#3f1aa8]'
                                        : 'border-[#eceaf4] bg-white text-[#3c3c46]',
                                    isEnabled ? 'hover:border-[#d8d6e4]' : 'opacity-40'
                                )}
                            >
                                {kind === 'colorTheme' ? (
                                    <>
                                        <span
                                            className="h-6 w-6 rounded-full border border-[#d8d6e4]"
                                            style={{ backgroundColor: option.swatch ?? '#dcdbe8' }}
                                        />
                                        <span className="mt-2 text-[10px]">{option.label}</span>
                                    </>
                                ) : (
                                    <span className="text-[11px]">{option.label}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function BottomNav({ items, activeId, onChange, className }: { items: any[]; activeId: string; onChange: (item: any) => void; className?: string }) {
    return (
        <div className={cn("mt-auto grid grid-cols-4 gap-2 rounded-2xl border border-[#eceaf4] bg-white px-2 py-2 text-[10px] font-semibold text-[#9a9aa6]", className)} data-iphone-interactive="true">
            {items.map((item) => {
                const isActive = item.id === activeId;
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onChange(item)}
                        className={cn(
                            'relative flex flex-col items-center gap-1 rounded-xl px-1 py-1 transition',
                            isActive ? 'text-[#3f1aa8]' : 'hover:text-[#3f1aa8]'
                        )}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                    >
                        <span className="material-symbols-outlined text-base leading-none">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                        {item.badge ? <span className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-[#f1a94b]" /> : null}
                    </button>
                );
            })}
        </div>
    );
}

function ResultsView({ results, meta, onBack }: { results: any[]; meta: any; onBack: () => void }) {
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const [isEditExpanded, setIsEditExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSliderMove = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPosition(percentage);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        handleSliderMove(e.clientX);
        // Important: capture potential on the container itself to ensure events track even if mouse leaves
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            handleSliderMove(e.clientX);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const beforeImage = results[0]?.image ?? '/home/demo/screen-1.svg';
    const afterImage = results[1]?.image ?? '/home/demo/screen-2.svg';

    return (
        <div className="flex h-full flex-col pb-[0px]">
            <div className="flex items-center gap-2 mb-3">
                <button
                    onClick={onBack}
                    className="h-8 w-8 rounded-full flex items-center justify-center bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                    data-iphone-interactive="true"
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                </button>
                <span className="font-semibold text-slate-800">{meta?.title}</span>
            </div>

            <div
                ref={containerRef}
                data-iphone-interactive="true"
                className="relative h-[240px] w-full overflow-hidden rounded-[18px] bg-gradient-to-br from-[#f3f0ff] via-[#f7f6fb] to-[#fef2eb] shadow-[0_12px_24px_rgba(90,86,120,0.18)]"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    handlePointerDown(e);
                }}
                onPointerMove={(e) => {
                    e.stopPropagation();
                    handlePointerMove(e);
                }}
                onPointerUp={(e) => {
                    e.stopPropagation();
                    handlePointerUp(e);
                }}
                onPointerLeave={(e) => {
                    // Do not stop dragging on leave if we have capture, but stop propagation
                    e.stopPropagation();
                }}
            >
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${afterImage})` }}
                />

                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url(${beforeImage})`,
                        clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
                    }}
                />

                <div
                    className="absolute top-0 h-full w-0.5 bg-white shadow-lg"
                    style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                >
                    <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
                        <span className="material-symbols-outlined text-sm text-[#3f1aa8] leading-none">drag_indicator</span>
                    </div>
                </div>

                <div className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-[#6a6a7a] backdrop-blur-sm pointer-events-none">
                    Before
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-[#3c3c46]/80 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm pointer-events-none">
                    After
                </div>
            </div>

            <div data-iphone-interactive="true" className="mx-auto mt-4 flex items-center gap-1 rounded-full border border-[#eceaf4] bg-white px-2 py-2 shadow-sm">
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#7a7a8a] transition hover:bg-[#f7f6fb] hover:text-[#3f1aa8]" onPointerDown={(e) => e.stopPropagation()} onPointerDownCapture={(e) => e.stopPropagation()}>
                    <span className="material-symbols-outlined text-lg leading-none">rotate_right</span>
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#7a7a8a] transition hover:bg-[#f7f6fb] hover:text-[#3f1aa8]" onPointerDown={(e) => e.stopPropagation()} onPointerDownCapture={(e) => e.stopPropagation()}>
                    <span className="material-symbols-outlined text-lg leading-none">tune</span>
                </button>
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3f1aa8] text-white shadow-md transition hover:bg-[#35138d]" onPointerDown={(e) => e.stopPropagation()} onPointerDownCapture={(e) => e.stopPropagation()}>
                    <span className="material-symbols-outlined text-xl leading-none">favorite</span>
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#7a7a8a] transition hover:bg-[#f7f6fb] hover:text-[#3f1aa8]" onPointerDown={(e) => e.stopPropagation()} onPointerDownCapture={(e) => e.stopPropagation()}>
                    <span className="material-symbols-outlined text-lg leading-none">share</span>
                </button>
            </div>

            <div className="mt-4 px-1 text-center">
                <p className="text-sm text-slate-500">
                    Drag the slider to compare original vs AI generated design.
                </p>
            </div>

        </div>
    );
}
