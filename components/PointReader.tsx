
import React, { useRef, useState, useEffect } from 'react';
import { TextBlock } from '../types';

interface PointReaderProps {
  imageUrl: string;
  blocks: TextBlock[];
  onTextClick: (text: string, block: TextBlock) => void;
  activeBlock: TextBlock | null;
  isAnalyzing: boolean;
}

const PointReader: React.FC<PointReaderProps> = ({ imageUrl, blocks, onTextClick, activeBlock, isAnalyzing }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImgSize({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  };

  useEffect(() => {
    const handleResize = () => handleImageLoad();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (!imgRef.current || blocks.length === 0 || isAnalyzing) return;

    const rect = imgRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 1000;
    const clickY = ((e.clientY - rect.top) / rect.height) * 1000;

    const candidates = blocks.filter((block) => {
      const [ymin, xmin, ymax, xmax] = block.box_2d;
      return clickY >= ymin && clickY <= ymax && clickX >= xmin && clickX <= xmax;
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const areaA = (a.box_2d[2] - a.box_2d[0]) * (a.box_2d[3] - a.box_2d[1]);
        const areaB = (b.box_2d[2] - b.box_2d[0]) * (b.box_2d[3] - b.box_2d[1]);
        return areaA - areaB;
      });
      onTextClick(candidates[0].text, candidates[0]);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative inline-block overflow-hidden rounded-xl shadow-2xl bg-white cursor-crosshair group"
      onClick={handleClick}
    >
      <img
        ref={imgRef}
        src={imageUrl}
        onLoad={handleImageLoad}
        alt="Upload target"
        className={`max-w-full h-auto block transition-filter duration-500 ${isAnalyzing ? 'blur-[2px] grayscale-[30%]' : ''}`}
      />
      
      {/* 扫描动画层 */}
      {isAnalyzing && (
        <>
          <div className="scan-overlay" />
          <div className="scanner-line" />
        </>
      )}
      
      {/* 文本区域高亮 */}
      {!isAnalyzing && blocks.map((block, idx) => {
        const [ymin, xmin, ymax, xmax] = block.box_2d;
        const left = (xmin / 1000) * 100;
        const top = (ymin / 1000) * 100;
        const width = ((xmax - xmin) / 1000) * 100;
        const height = ((ymax - ymin) / 1000) * 100;

        const isActive = activeBlock === block;

        return (
          <div
            key={idx}
            className={`absolute border transition-all duration-300 pointer-events-none rounded ${
              isActive 
                ? 'bg-yellow-400/30 border-yellow-500 scale-105 z-10 shadow-[0_0_10px_rgba(234,179,8,0.5)]' 
                : 'bg-blue-400/5 border-transparent opacity-0 group-hover:opacity-100'
            }`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
            }}
          />
        );
      })}
    </div>
  );
};

export default PointReader;
