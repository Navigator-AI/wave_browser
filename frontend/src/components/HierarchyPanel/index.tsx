/**
 * Main hierarchy panel component
 */

import { HierarchyTree } from './HierarchyTree';
import { SignalList } from './SignalList';
import { useWaveformStore } from '../../store';

export function HierarchyPanel() {
  const { currentSession } = useWaveformStore();

  if (!currentSession) {
    return (
      <div className="h-full flex items-center justify-center text-wave-text/50">
        No session open
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-wave-panel">
      {/* Hierarchy tree */}
      <div className="h-1/3 min-h-[120px] overflow-auto border-b border-wave-border">
        <div className="text-xs font-medium text-wave-text/70 px-3 py-2 border-b border-wave-border bg-wave-bg/50 sticky top-0">
          HIERARCHY
          <span className="text-wave-text/40 ml-2 font-normal">(double-click to add all signals)</span>
        </div>
        <HierarchyTree sessionId={currentSession.id} />
      </div>

      {/* Signal list */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="text-xs font-medium text-wave-text/70 px-3 py-2 border-b border-wave-border bg-wave-bg/50">
          SIGNALS
        </div>
        <div className="flex-1 overflow-hidden">
          <SignalList sessionId={currentSession.id} />
        </div>
      </div>
    </div>
  );
}
