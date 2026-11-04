export function ChartPreview({ svg, className = "" }: { svg: string; className?: string }) {
  return <div className={`chart-preview ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
