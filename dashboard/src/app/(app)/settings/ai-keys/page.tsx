'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api/client';

interface AiKeyStatus {
  provider: string;
  configured: boolean;
  mode: 'hosted' | 'byok';
  key_prefix?: string;
  verified?: boolean;
  verified_at?: string;
  updated_at?: string;
}

export default function AiKeysPage() {
  const queryClient = useQueryClient();
  const [inputKey, setInputKey] = useState('');
  const [showInput, setShowInput] = useState(false);

  const { data: keyStatus, isLoading } = useQuery({
    queryKey: ['ai-keys', 'anthropic'],
    queryFn: async () => {
      const res = await apiClient.get<AiKeyStatus>('/api/v1/settings/ai-keys/anthropic');
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiClient.put('/api/v1/settings/ai-keys/anthropic', { key });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-keys', 'anthropic'] });
      setInputKey('');
      setShowInput(false);
      toast.success('Anthropic key saved', {
        description: `Key ${data.key_prefix}... verified and active.`,
      });
    },
    onError: (err: any) => {
      toast.error('Failed to save key', {
        description: err.response?.data?.error || 'Check the key and try again.',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete('/api/v1/settings/ai-keys/anthropic');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-keys', 'anthropic'] });
      toast.success('Key removed', {
        description: 'Reverted to OpenJCK hosted key.',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/v1/settings/ai-keys/anthropic/test');
      return res.data;
    },
    onSuccess: (data) => {
      if (data.status === 'ok') {
        toast.success('Key test passed', { description: data.message });
      } else {
        toast.error('Key test failed', { description: data.message });
      }
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        <div className="h-6 w-48 bg-[var(--oj-surface-2)] animate-shimmer rounded" />
        <div className="h-32 w-full bg-[var(--oj-card-gradient)] animate-shimmer rounded-md border border-[var(--oj-border)]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--oj-text-primary)]">AI Provider Keys</h1>
        <p className="text-sm text-[var(--oj-text-muted)] mt-1">
          Control which Anthropic API key powers AI Fix and other AI features.
        </p>
      </div>

      {/* Mode explanation */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className={`p-4 border rounded-lg transition-all cursor-default ${
          keyStatus?.mode === 'hosted'
            ? 'border-amber-500 bg-[var(--oj-accent-glow)] shadow-[var(--shadow-glow-amber)]'
            : 'border-[var(--oj-border)] bg-[var(--oj-card-gradient)] hover:border-[var(--oj-border-amber)]'
        }`}>
          <div className="flex items-start gap-2">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
              keyStatus?.mode === 'hosted' ? 'bg-amber-400' : 'bg-[var(--oj-text-muted)]'
            }`} />
            <div>
              <p className="text-sm font-medium text-[var(--oj-text-primary)]">OpenJCK Hosted</p>
              <p className="text-xs text-[var(--oj-text-muted)] mt-0.5">
                We use our key. Included in your plan.
                Zero setup required.
              </p>
            </div>
          </div>
         </div>

        <div className={`p-4 border rounded-lg transition-all cursor-default ${
          keyStatus?.mode === 'byok'
            ? 'border-amber-500 bg-[var(--oj-accent-glow)] shadow-[var(--shadow-glow-amber)]'
            : 'border-[var(--oj-border)] bg-[var(--oj-card-gradient)] hover:border-[var(--oj-border-amber)]'
        }`}>
          <div className="flex items-start gap-2">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
              keyStatus?.mode === 'byok' ? 'bg-amber-400' : 'bg-[var(--oj-text-muted)]'
            }`} />
            <div>
              <p className="text-sm font-medium text-[var(--oj-text-primary)]">Your Own Key (BYOK)</p>
              <p className="text-xs text-[var(--oj-text-muted)] mt-0.5">
                You pay Anthropic directly.
                OpenJCK makes zero margin on AI calls.
              </p>
            </div>
           </div>
         </div>
       </div>

       <div className="border-t border-[var(--oj-border)] mb-6" />

       {/* Anthropic Key Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[var(--oj-text-muted)]" />
            <span className="text-sm font-medium text-[var(--oj-text-primary)]">Anthropic</span>
            {keyStatus?.mode === 'byok' && keyStatus.verified && (
              <Badge className="bg-[var(--oj-success-muted)] text-[var(--oj-success)] border-0 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
            {keyStatus?.mode === 'byok' && !keyStatus.verified && (
              <Badge className="bg-[var(--oj-danger-muted)] text-[var(--oj-danger)] border-0 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Unverified
              </Badge>
            )}
            {keyStatus?.mode === 'hosted' && (
              <Badge className="bg-[var(--oj-accent-glow)] text-amber-400 border-0 text-xs">
                OpenJCK Hosted
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {keyStatus?.mode === 'byok' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                  className="text-xs text-[var(--oj-text-muted)] hover:text-[var(--oj-text-primary)]"
                >
                  {testMutation.isPending ? 'Testing...' : 'Test key'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInput(true)}
                  className="text-xs text-[var(--oj-text-muted)] hover:text-[var(--oj-text-primary)]"
                >
                  Replace
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMutation.mutate()}
                  disabled={removeMutation.isPending}
                  className="text-xs text-[var(--oj-danger)] hover:text-[var(--oj-danger)]"
                >
                  Remove
                </Button>
              </>
            )}
            {keyStatus?.mode === 'hosted' && !showInput && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInput(true)}
                className="text-xs border-[var(--oj-border)] text-[var(--oj-text-secondary)] hover:bg-[var(--oj-surface-hover)] hover:text-[var(--oj-text-primary)]"
              >
                Use your own key
              </Button>
            )}
          </div>
        </div>

        {/* Current key display */}
        {keyStatus?.mode === 'byok' && keyStatus.key_prefix && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--oj-surface-2)] rounded-md border border-[var(--oj-border)]">
            <KeyRound className="h-3 w-3 text-[var(--oj-text-muted)]" />
            <span className="text-sm font-mono text-[var(--oj-text-secondary)]">
              {keyStatus.key_prefix}••••••••••••••••••••••••••
            </span>
            {keyStatus.updated_at && (
              <span className="text-xs text-[var(--oj-text-muted)] ml-auto">
                Updated {new Date(keyStatus.updated_at).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {/* Input for new key */}
        {showInput && (
          <div className="space-y-3 p-4 bg-[var(--oj-surface-1)] rounded-md border border-[var(--oj-border)]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--oj-text-muted)] uppercase tracking-wide">
                Anthropic API Key
              </label>
              <Input
                type="password"
                placeholder="sk-ant-api03-..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="font-mono text-sm bg-[var(--oj-surface-2)] border-[var(--oj-border)]"
                autoFocus
              />
              <p className="text-xs text-[var(--oj-text-muted)]">
                Key is validated against Anthropic before saving.
                Stored AES-256-GCM encrypted. Never logged or returned.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(inputKey)}
                disabled={!inputKey.startsWith('sk-ant-') || saveMutation.isPending}
                className="bg-amber-500 hover:bg-amber-400 text-[var(--oj-bg)]"
              >
                {saveMutation.isPending ? 'Validating...' : 'Save & Verify'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowInput(false); setInputKey(''); }}
                className="text-[var(--oj-text-secondary)] hover:text-[var(--oj-text-primary)]"
              >
                Cancel
              </Button>
            </div>

            {/* Helpful link */}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline"
            >
              Get an Anthropic API key
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

       <div className="border-t border-[var(--oj-border)] my-6" />

       {/* Info box */}
      <div className="p-4 bg-[var(--oj-surface-1)] rounded-md border border-[var(--oj-border)]">
        <p className="text-xs font-medium text-[var(--oj-text-secondary)] mb-2">
          How AI key billing works
        </p>
        <ul className="space-y-1.5">
          {[
            'OpenJCK Hosted: AI calls included in your Pro/Enterprise plan. We eat the cost.',
            'BYOK: You pay Anthropic directly at their rates. OpenJCK charges zero margin on AI.',
            'BYOK is purely for cost control — there is no capability difference between modes.',
            'Your key is validated and encrypted before storage. It is never returned via API.',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-[var(--oj-text-muted)]">
              <span className="text-amber-400 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
