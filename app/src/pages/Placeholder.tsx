import { Card, CardBody } from '@heroui/react';

interface Props {
  title: string;
  desc?: string;
}

/**
 * 骨架阶段统一占位页,后续按设计文档逐个替换为完整页面
 */
export default function Placeholder({ title, desc }: Props) {
  return (
    <div className="flex min-h-full flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">{title}</h1>
        {desc && <p className="text-xs text-foreground/50">{desc}</p>}
      </header>
      <Card>
        <CardBody className="py-12 text-center text-sm text-foreground/50">
          该页面待后续按 UI 设计文档实现
        </CardBody>
      </Card>
    </div>
  );
}
