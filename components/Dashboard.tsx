import React, { useState, useEffect } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useAuth, useUsage } from '../auth';
import { getGenerations } from '../api';
import { Calendar, Image, Loader2, LogIn, ChevronRight } from 'lucide-react';

interface Generation {
  id: string;
  type: 'moodboard' | 'applyMaterials' | 'upscale' | 'materialIcon' | 'sustainabilityBriefing';
  blobUrl?: string;
  createdAt: string;
  prompt: string;
  materials?: unknown;
}

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

const typeLabels: Record<string, string> = {
  moodboard: 'Moodboard',
  applyMaterials: 'Applied Materials',
  upscale: '4K Upscale',
  materialIcon: 'Material Icon',
  sustainabilityBriefing: 'Sustainability',
};

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user, isAuthenticated, getAccessToken, login } = useAuth();
  const { usage, remaining, limit } = useUsage();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit_per_page = 12;

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchGenerations = async () => {
      setIsLoading(true);
      try {
        const token = await getAccessToken();
        if (token) {
          const data = await getGenerations(token, { limit: limit_per_page, offset: 0 });
          setGenerations(data.items || []);
          setHasMore(data.hasMore || false);
          setOffset(limit_per_page);
        }
      } catch (error) {
        console.error('Failed to fetch generations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGenerations();
  }, [isAuthenticated, getAccessToken]);

  const loadMore = async () => {
    if (!isAuthenticated || !hasMore) return;

    try {
      const token = await getAccessToken();
      if (token) {
        const data = await getGenerations(token, { limit: limit_per_page, offset });
        setGenerations((prev) => [...prev, ...(data.items || [])]);
        setHasMore(data.hasMore || false);
        setOffset((prev) => prev + limit_per_page);
      }
    } catch (error) {
      console.error('Failed to load more generations:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="w-full min-h-screen pt-20 bg-white">
        <div className="max-w-screen-lg mx-auto px-6 py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <LogIn className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="font-display text-4xl font-bold uppercase tracking-tighter mb-4">
            Sign In Required
          </h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Sign in to view your dashboard, track your usage, and access your generation history.
          </p>
          <SignInButton mode="modal">
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-mono text-[11px] uppercase tracking-widest hover:bg-gray-900 transition-colors">
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen pt-20 bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-6">
          <h1 className="font-display text-5xl font-bold uppercase tracking-tighter">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {user?.name || 'User'}
          </p>
        </div>

        {/* Usage Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Remaining This Month
            </div>
            <div className="font-display text-4xl font-bold">
              {remaining}{' '}
              <span className="text-gray-400 text-2xl">/ {limit}</span>
            </div>
          </div>
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Moodboards
            </div>
            <div className="font-display text-4xl font-bold">
              {usage?.moodboard ?? 0}
            </div>
          </div>
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Applied Materials
            </div>
            <div className="font-display text-4xl font-bold">
              {usage?.applyMaterials ?? 0}
            </div>
          </div>
          <div className="border border-gray-200 p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Total This Month
            </div>
            <div className="font-display text-4xl font-bold">
              {usage?.total ?? 0}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => onNavigate?.('moodboard')}
            className="group flex items-center justify-between p-6 border border-gray-200 hover:border-black transition-colors"
          >
            <div className="text-left">
              <h3 className="font-display text-xl font-bold uppercase tracking-tight">
                Create Moodboard
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Generate a new AI moodboard from your selected materials
              </p>
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-black transition-colors" />
          </button>
          <button
            onClick={() => onNavigate?.('apply')}
            className="group flex items-center justify-between p-6 border border-gray-200 hover:border-black transition-colors"
          >
            <div className="text-left">
              <h3 className="font-display text-xl font-bold uppercase tracking-tight">
                Apply Materials
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Apply your material palette to an uploaded design
              </p>
            </div>
            <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-black transition-colors" />
          </button>
        </div>

        {/* Generation History */}
        <div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight mb-4">
            Recent Generations
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : generations.length === 0 ? (
            <div className="border border-dashed border-gray-300 p-8 text-center">
              <Image className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">No generations yet.</p>
              <button
                onClick={() => onNavigate?.('moodboard')}
                className="px-4 py-2 bg-black text-white font-mono text-[11px] uppercase tracking-widest"
              >
                Create Your First Moodboard
              </button>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {generations.map((gen) => (
                  <div
                    key={gen.id}
                    className="border border-gray-200 overflow-hidden group hover:border-black transition-colors"
                  >
                    {gen.blobUrl ? (
                      <div className="aspect-square bg-gray-100 overflow-hidden">
                        <img
                          src={gen.blobUrl}
                          alt={gen.type}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-100 flex items-center justify-center">
                        <Image className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500 bg-gray-100 px-2 py-1">
                          {typeLabels[gen.type] || gen.type}
                        </span>
                        <span className="flex items-center gap-1 text-gray-500 text-xs">
                          <Calendar className="w-3 h-3" />
                          {new Date(gen.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {gen.prompt && (
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {gen.prompt.slice(0, 100)}
                          {gen.prompt.length > 100 ? '...' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="text-center mt-8">
                  <button
                    onClick={loadMore}
                    className="px-6 py-2 border border-gray-200 font-mono text-[11px] uppercase tracking-widest hover:border-black transition-colors"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
