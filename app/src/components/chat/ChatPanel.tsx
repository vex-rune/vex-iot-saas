/**
 * AI 对话浮窗组件。
 * 右下角悬浮按钮 → 点击展开对话面板。
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {Button, Input, ScrollShadow} from '@heroui/react';
import {ChatBubbleLeftRightIcon, PaperAirplaneIcon, XMarkIcon} from '@heroicons/react/24/outline';
import {sendChatMessage} from '@/api/aiApi';
import type {ChatApiResponse, ChatMessage} from '@/types/chat';
import {MessageBubble} from './MessageBubble';

const STORAGE_KEY = 'vex_ai_conversation_id';
const STORAGE_EXPIRY = 'vex_ai_conversation_expiry';

function getSavedConversationId(): string | undefined {
    const saved = localStorage.getItem(STORAGE_KEY);
    const expiry = localStorage.getItem(STORAGE_EXPIRY);
    if (saved && expiry && Date.now() < Number(expiry)) return saved;
    return undefined;
}

export default function ChatPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | undefined>(getSavedConversationId);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // 悬浮球位置 & 拖拽
    const [pos, setPos] = useState({x: 0, y: 0});
    const [dragging, setDragging] = useState(false);
    const movedRef = useRef(false);
    const dragStart = useRef({x: 0, y: 0, posX: 0, posY: 0});

    useEffect(() => {
        scrollRef.current?.scrollTo({top: scrollRef.current.scrollHeight});
    }, [messages]);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
    }, [isOpen]);

    const sendMessage = useCallback(() => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg: ChatMessage = {
            id: `user-${Date.now()}`, role: 'user', content: text, timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        sendChatMessage({message: text, conversationId})
            .onSuccess((data: ChatApiResponse) => {
                if (data.conversationId) {
                    setConversationId(data.conversationId);
                    localStorage.setItem(STORAGE_KEY, data.conversationId);
                    localStorage.setItem(STORAGE_EXPIRY, String(Date.now() + 24 * 3600 * 1000));
                }
                setMessages(prev => [...prev, {
                    id: `ai-${Date.now()}`, role: 'assistant', content: data.reply,
                    data: data.data as Record<string, unknown>[] | undefined,
                    visualization: data.visualization as ChatMessage['visualization'],
                    conversationId: data.conversationId, timestamp: Date.now(),
                }]);
                setLoading(false);
            })
            .onBizError((err) => {
                setMessages(prev => [...prev, {
                    id: `ai-err-${Date.now()}`, role: 'assistant',
                    content: `错误: ${err.message}`, timestamp: Date.now(),
                }]);
                setLoading(false);
            })
            .onHttpError(() => {
                setMessages(prev => [...prev, {
                    id: `ai-err-${Date.now()}`, role: 'assistant',
                    content: '网络异常，请稍后重试', timestamp: Date.now(),
                }]);
                setLoading(false);
            })
            .execute();
    }, [input, loading, conversationId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([]);
        setConversationId(undefined);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_EXPIRY);
    };

    // 拖拽处理 — document 级别监听，标准 React 拖拽模式
    const onPointerDown = (e: React.PointerEvent) => {
        if (isOpen) return;
        movedRef.current = false;
        dragStart.current = {x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y};
        setDragging(true);
    };

    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: PointerEvent) => {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            movedRef.current = true;
            const nx = dragStart.current.posX + dx;
            const ny = dragStart.current.posY + dy;
            const maxX = window.innerWidth - 60;
            const maxY = window.innerHeight - 60;
            setPos({
                x: Math.max(-dragStart.current.posX, Math.min(nx, maxX)),
                y: Math.max(-dragStart.current.posY, Math.min(ny, maxY))
            });
        };
        const onUp = () => {
            setDragging(false);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        return () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        };
    }, [dragging]);

    const handleBallPress = () => {
        if (movedRef.current) {
            movedRef.current = false;
            return;
        }
        setIsOpen(!isOpen);
    };

    return (
        <>
            {/* 悬浮按钮 — 可拖拽 */}
            <div
                className="fixed z-50"
                style={{
                    bottom: '1.5rem', left: '1.5rem',
                    transform: `translate(${pos.x}px,${pos.y}px)`,
                    transition: dragging ? 'none' : 'transform 0.2s',
                }}
                onPointerDown={onPointerDown}
            >
                <Button isIconOnly color="primary" size="lg" radius="full"
                        className="shadow-lg cursor-grab active:cursor-grabbing" onPress={handleBallPress}>
                    {isOpen ? <XMarkIcon className="h-6 w-6"/>
                        : <ChatBubbleLeftRightIcon className="h-6 w-6"/>}
                </Button>
            </div>

            {/* 对话面板 */}
            {isOpen && (
                <div
                    className="fixed bottom-20 left-6 z-50 flex w-[380px] max-w-[calc(100vw-3rem)] flex-col rounded-2xl border border-divider bg-content1 shadow-2xl"
                    style={{height: 'min(560px, calc(100vh - 120px))'}}>
                    <div className="flex items-center justify-between border-b border-divider px-4 py-3">
                        <div className="flex items-center gap-2">
                            <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary"/>
                            <span className="font-semibold text-foreground">AI 助手</span>
                        </div>
                        <Button isIconOnly size="sm" variant="light" onPress={clearChat}>清空</Button>
                    </div>

                    <ScrollShadow ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
                        {messages.length === 0 && (
                            <div className="flex h-full items-center justify-center text-sm text-foreground/50">
                                <div className="text-center">
                                    <p className="mb-2">👋 你好！我是 Vex AI 助手</p>
                                    <p>你可以问我关于设备、数据、报警的问题</p>
                                    <div className="mt-3 flex flex-wrap gap-2 justify-center">
                                        {['查看所有在线设备', '今天有多少报警', '3号设备的温度数据'].map(q => (
                                            <button key={q}
                                                    className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20"
                                                    onClick={() => setInput(q)}>{q}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {messages.map(msg => (<MessageBubble key={msg.id} message={msg}/>))}
                        {loading && (
                            <div className="mb-3 flex justify-start">
                                <div className="rounded-2xl bg-content2 px-4 py-2 text-sm text-foreground/60">
                                    <span className="animate-pulse">思考中...</span>
                                </div>
                            </div>
                        )}
                    </ScrollShadow>

                    <div className="border-t border-divider px-3 py-2">
                        <div className="flex gap-2">
                            <Input ref={inputRef} value={input} onValueChange={setInput}
                                   onKeyDown={handleKeyDown} placeholder="输入你的问题..."
                                   variant="flat" size="sm" disabled={loading} className="flex-1"/>
                            <Button isIconOnly color="primary" size="sm" onPress={sendMessage}
                                    isLoading={loading} isDisabled={!input.trim()}>
                                <PaperAirplaneIcon className="h-4 w-4"/>
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
