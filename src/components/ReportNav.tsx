import { useState, useEffect } from 'react';

interface NavItem {
  id: string;
  label: string;
}

export default function ReportNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id || '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -60% 0px' }
    );

    items.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="sticky top-0 z-10 bg-card/90 backdrop-blur-sm border-b border-border/50 print:hidden">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center gap-1 py-2 overflow-x-auto">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                active === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
