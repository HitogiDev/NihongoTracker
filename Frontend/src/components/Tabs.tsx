import { useState } from 'react';

interface Tab {
  label: string;
  component: (isActive: boolean) => React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
}

function Tabs({ tabs }: TabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0].label);

  return (
    <div>
      <div role="tablist" className="tabs tabs-border px-4">
        {tabs.map((tab, i) => (
          <a
            key={i}
            role="tab"
            className={`tab ${
              activeTab === tab.label ? 'tab-active font-bold' : ''
            }`}
            onClick={() => setActiveTab(tab.label)}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {tabs.map((tab, i) => {
        const isActive = activeTab === tab.label;
        return (
          <div
            key={i}
            role="tabpanel"
            className={`tab-content bg-base-100 border-base-300 rounded-box p-6 ${
              isActive ? 'block' : 'hidden'
            }`}
          >
            {tab.component(isActive)}
          </div>
        );
      })}
    </div>
  );
}

export default Tabs;
