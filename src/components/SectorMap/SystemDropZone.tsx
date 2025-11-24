import { useDrop } from 'react-dnd';
import './SystemDropZone.css';

interface SystemDropZoneProps {
  systemId: string;
  systemName: string;
  x: number;
  y: number;
  onDrop: (assetDefinitionId: string, systemId: string) => void;
}

interface DragItem {
  assetDefinitionId: string;
  assetName: string;
  cost: number;
  factionId: string | null;
}

export default function SystemDropZone({
  systemId,
  systemName,
  x,
  y,
  onDrop,
}: SystemDropZoneProps) {
  const [{ isOver, canDrop }, drop] = useDrop<DragItem, void, { 
    isOver: boolean; 
    canDrop: boolean;
  }>(
    () => ({
      accept: 'ASSET',
      drop: (item) => {
        if (item.factionId) {
          onDrop(item.assetDefinitionId, systemId);
        }
      },
      canDrop: (item) => item.factionId !== null,
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop() && monitor.getItemType() === 'ASSET',
      }),
    }),
    [systemId, onDrop]
  );

  const isActive = isOver && canDrop;

  return (
    <div
      ref={drop as unknown as React.Ref<HTMLDivElement>}
      className={`system-drop-zone ${isActive ? 'drop-active' : ''} ${canDrop ? 'can-drop' : ''}`}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(-50%, -50%)',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        // Make completely invisible and non-interactive when not active
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 100 : 0,
        transition: 'opacity 0.2s',
      }}
      title={isActive ? `Drop asset on ${systemName}` : systemName}
    >
      {isActive && (
        <div className="drop-zone-indicator">
          Drop here
        </div>
      )}
    </div>
  );
}

