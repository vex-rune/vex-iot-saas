/**
 * 单条对话消息组件。
 */
import type {ChatMessage} from '@/types/chat';

interface Props {
    message: ChatMessage;
}

export function MessageBubble({message}: Props) {
    const isUser = message.role === 'user';

    return (
        <div className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                isUser
                    ? 'bg-primary text-white'
                    : 'bg-content2 text-foreground'
            }`}>
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* 数据表格 */}
                {!isUser && message.data && message.data.length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                        <DataTable data={message.data}/>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * 简单数据表格 — 渲染 AI 返回的结构化数据。
 */
function DataTable({data}: { data: Record<string, unknown>[] }) {
    if (!data || data.length === 0) return null;

    const columns = Object.keys(data[0]);
    const displayCols = columns.slice(0, 6); // 最多显示 6 列
    const rows = data.slice(0, 20); // 最多显示 20 行

    const labelMap: Record<string, string> = {
        deviceName: '设备名称', online: '在线状态', enabled: '启用',
        level1Tag: '标签', lastHeartbeatAt: '最后心跳',
        pointName: '点位名称', pointCode: '编码', unit: '单位',
        dataType: '类型', deviceName2: '设备',
        timestamp: '时间', intValue: '整数值', doubleValue: '浮点值',
        stringValue: '值', dataState: '状态',
        level: '级别', message: '消息', eventStatus: '状态',
        triggeredAt: '触发时间', ruleName: '规则名称', source: '来源',
    };

    return (
        <table className="mt-1 w-full text-xs">
            <thead>
            <tr className="border-b border-divider">
                {displayCols.map(col => (
                    <th key={col} className="px-2 py-1 text-left font-medium opacity-70">
                        {labelMap[col] ?? col}
                    </th>
                ))}
            </tr>
            </thead>
            <tbody>
            {rows.map((row, i) => (
                <tr key={i} className="border-b border-divider/50">
                    {displayCols.map(col => (
                        <td key={col} className="px-2 py-1">
                            {formatCell(row[col])}
                        </td>
                    ))}
                </tr>
            ))}
            </tbody>
        </table>
    );
}

function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '✅' : '❌';
    if (typeof value === 'string' && value.length > 19 && value.includes('T')) {
        // ISO 时间 → 简短格式
        try {
            const d = new Date(value);
            return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } catch { /* fall through */
        }
    }
    return String(value);
}
