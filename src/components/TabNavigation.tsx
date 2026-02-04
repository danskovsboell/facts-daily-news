'use client';

import { TABS, SUB_TABS } from '@/lib/constants';
import { TabId, SubCategory } from '@/lib/types';

interface TabNavigationProps {
  activeTab: TabId;
  activeSubTab: SubCategory;
  onTabChange: (tab: TabId) => void;
  onSubTabChange: (subTab: SubCategory) => void;
}

export default function TabNavigation({
  activeTab,
  activeSubTab,
  onTabChange,
  onSubTabChange,
}: TabNavigationProps) {
  return (
    <div className="space-y-2">
      {/* Main tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-900 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      {activeTab !== 'sladder' && activeTab !== 'dine-nyheder' && (
        <div className="flex gap-1 px-1">
          {SUB_TABS.map((subTab) => (
            <button
              key={subTab.id}
              onClick={() => onSubTabChange(subTab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeSubTab === subTab.id
                  ? 'bg-zinc-700 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {subTab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
