import { useState, useEffect } from "react";

interface User {
  login: string;
  avatar_url: string;
  name: string;
  email?: string;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
}

interface GeneratedIssue {
  title: string;
  body: string;
  labels: string[];
  priority?: number;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [creatingIssues, setCreatingIssues] = useState(false);

  // LLM関連の状態
  const [generatedIssues, setGeneratedIssues] = useState<GeneratedIssue[]>([]);
  const [markdownContent, setMarkdownContent] = useState("");
  const [generatingIssues, setGeneratingIssues] = useState(false);
  const [sampleMarkdown, setSampleMarkdown] = useState("");

  // モーダル関連の状態
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    issue: GeneratedIssue | null;
    index: number | null;
  }>({
    isOpen: false,
    issue: null,
    index: null,
  });
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    issue: GeneratedIssue | null;
    index: number | null;
  }>({
    isOpen: false,
    issue: null,
    index: null,
  });
  const [editingIssue, setEditingIssue] = useState<GeneratedIssue>({
    title: "",
    body: "",
    labels: [],
    priority: 1,
  });

  useEffect(() => {
    checkAuthStatus();
    loadSampleMarkdown();

    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get("error");
    if (errorParam) {
      setError(`認証エラー: ${errorParam}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        loadRepositories();
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSampleMarkdown = async () => {
    try {
      const response = await fetch("/api/llm/sample-markdown");
      if (response.ok) {
        const data = await response.json();
        setSampleMarkdown(data.markdown);
        setMarkdownContent(data.markdown);
      }
    } catch (error) {
      console.error("Failed to load sample markdown:", error);
    }
  };

  const handleGithubLogin = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      setError("GitHub Client IDが設定されていません");
      return;
    }

    // 本番環境のURL取得
    const baseUrl = window.location.origin;
    const redirectUri = `${baseUrl}/api/auth/callback`;
    const scope = "user:email repo";
    const state = Math.random().toString(36).substring(7);

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
    window.location.href = githubAuthUrl;
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      setError(null);
      setRepositories([]);
      setSelectedRepo(null);
      setSelectedIssues(new Set());
      setGeneratedIssues([]);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const loadRepositories = async () => {
    setLoadingRepos(true);
    setError(null);
    try {
      const response = await fetch("/api/github/repositories", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load repositories");
      }

      const repos = await response.json();
      setRepositories(repos);
    } catch (error) {
      setError("リポジトリの読み込みに失敗しました。再試行してください。");
      console.error("Failed to load repositories:", error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const generateIssues = async () => {
    if (!selectedRepo) {
      setError("最初にリポジトリを選択してください。");
      return;
    }

    setGeneratingIssues(true);
    setError(null);
    setGeneratedIssues([]);
    setSelectedIssues(new Set());

    try {
      const response = await fetch("/api/llm/generate-issues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          markdown_content: markdownContent,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setGeneratedIssues(result.issues || []);
    } catch (error) {
      console.error("Generate issues error:", error);
      setError("イシューの生成に失敗しました。再試行してください。");
    } finally {
      setGeneratingIssues(false);
    }
  };

  const toggleIssueSelection = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelection = new Set(selectedIssues);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIssues(newSelection);
  };

  const selectAllIssues = () => {
    if (selectedIssues.size === generatedIssues.length) {
      setSelectedIssues(new Set());
    } else {
      setSelectedIssues(new Set(generatedIssues.map((_, index) => index)));
    }
  };

  const openPreviewModal = (issue: GeneratedIssue, index: number) => {
    setPreviewModal({ isOpen: true, issue, index });
  };

  const closePreviewModal = () => {
    setPreviewModal({ isOpen: false, issue: null, index: null });
  };

  const openEditModal = (
    issue: GeneratedIssue,
    index: number,
    event?: React.MouseEvent
  ) => {
    if (event) {
      event.stopPropagation();
    }
    setEditingIssue({ ...issue });
    setEditModal({ isOpen: true, issue, index });
  };

  const closeEditModal = () => {
    setEditModal({ isOpen: false, issue: null, index: null });
    setEditingIssue({ title: "", body: "", labels: [], priority: 1 });
  };

  const saveEditedIssue = () => {
    if (editModal.index !== null) {
      const newIssues = [...generatedIssues];
      newIssues[editModal.index] = editingIssue;
      setGeneratedIssues(newIssues);
      closeEditModal();
    }
  };

  const addLabel = (label: string) => {
    if (label.trim() && !editingIssue.labels.includes(label.trim())) {
      setEditingIssue({
        ...editingIssue,
        labels: [...editingIssue.labels, label.trim()],
      });
    }
  };

  const removeLabel = (labelToRemove: string) => {
    setEditingIssue({
      ...editingIssue,
      labels: editingIssue.labels.filter((label) => label !== labelToRemove),
    });
  };

  const createSelectedIssues = async () => {
    if (!selectedRepo || selectedIssues.size === 0) return;

    setCreatingIssues(true);
    setError(null);

    const selectedIssuesList = Array.from(selectedIssues).map(
      (index) => generatedIssues[index]
    );
    const successfulIssues: string[] = [];
    const failedIssues: string[] = [];

    try {
      const createPromises = selectedIssuesList.map(async (issue) => {
        try {
          const response = await fetch("/api/github/create-issue", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              repository: selectedRepo.full_name,
              title: issue.title,
              body: issue.body,
              labels: issue.labels,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to create issue: ${issue.title}`);
          }

          const result = await response.json();
          successfulIssues.push(result.html_url);
          return { success: true, issue, result };
        } catch (error) {
          failedIssues.push(issue.title);
          return { success: false, issue, error };
        }
      });

      await Promise.all(createPromises);

      if (successfulIssues.length > 0) {
        setError(
          `✅ ${successfulIssues.length}個のイシューが正常に作成されました！${
            failedIssues.length > 0 ? ` 失敗: ${failedIssues.length}個` : ""
          }`
        );
        setSelectedIssues(new Set());
      } else {
        setError(`❌ すべてのイシューの作成に失敗しました。`);
      }

      setTimeout(() => setError(null), 10000);
    } catch (error) {
      setError("イシューの作成に失敗しました。再試行してください。");
      console.error("Failed to create issues:", error);
    } finally {
      setCreatingIssues(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex justify-center items-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-base-200">
        <div className="navbar bg-base-100 shadow-lg">
          <div className="navbar-start">
            <span className="btn btn-ghost normal-case text-xl">
              🤖 AI Issue Maker
            </span>
          </div>
          <div className="navbar-end">
            <button className="btn btn-primary" onClick={handleGithubLogin}>
              GitHubログイン
            </button>
          </div>
        </div>

        <div className="hero min-h-screen bg-base-200">
          <div className="hero-content text-center">
            <div className="max-w-2xl">
              <h1 className="text-5xl font-bold">🤖 AI Issue Maker</h1>
              <p className="py-6">
                要件定義からAIを使ってGitHubイシューを自動生成！
                GitHubでログインして始めましょう。
              </p>
              <div className="alert alert-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>GitHubアカウントでログインしてください。</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="navbar-start">
          <span className="btn btn-ghost normal-case text-xl">
            🤖 AI Issue Maker
          </span>
        </div>

        <div className="navbar-end">
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full">
                <img src={user.avatar_url} alt={user.login} />
              </div>
            </label>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
            >
              <li>
                <a className="justify-between">{user.name || user.login}</a>
              </li>
              <li>
                <a onClick={handleLogout}>ログアウト</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {error && (
          <div
            className={`alert ${
              error.startsWith("✅") ? "alert-success" : "alert-error"
            } mb-4`}
          >
            <span>{error}</span>
          </div>
        )}

        {/* Repository Selection */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">📂 リポジトリを選択</h2>

            {loadingRepos ? (
              <div className="flex items-center gap-2">
                <span className="loading loading-spinner loading-sm"></span>
                <span>リポジトリを読み込み中...</span>
              </div>
            ) : (
              <div className="form-control">
                <select
                  className="select select-bordered w-full max-w-md"
                  value={selectedRepo?.id || ""}
                  onChange={(e) => {
                    const repoId = parseInt(e.target.value);
                    const repo = repositories.find((r) => r.id === repoId);
                    setSelectedRepo(repo || null);
                    setGeneratedIssues([]);
                    setSelectedIssues(new Set());
                  }}
                >
                  <option value="">リポジトリを選択してください...</option>
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.full_name}{" "}
                      {repo.private ? "(プライベート)" : "(パブリック)"}
                    </option>
                  ))}
                </select>

                {selectedRepo && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>
                      <strong>選択中:</strong> {selectedRepo.full_name}
                    </p>
                    {selectedRepo.description && (
                      <p>{selectedRepo.description}</p>
                    )}
                    <a
                      href={selectedRepo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary"
                    >
                      GitHubで表示 ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Markdown Input and Generation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">📝 要件定義書</h3>
              <p className="text-sm text-gray-600 mb-4">
                プロジェクトの要件をMarkdown形式で入力してください。
              </p>

              <textarea
                className="textarea textarea-bordered w-full h-64 font-mono text-sm"
                placeholder="要件をMarkdown形式で入力してください..."
                value={markdownContent}
                onChange={(e) => setMarkdownContent(e.target.value)}
              />

              <div className="card-actions justify-between mt-4">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMarkdownContent(sampleMarkdown)}
                >
                  サンプルを読み込み
                </button>
                <button
                  className="btn btn-primary"
                  onClick={generateIssues}
                  disabled={
                    generatingIssues || !markdownContent.trim() || !selectedRepo
                  }
                >
                  {generatingIssues ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      生成中...
                    </>
                  ) : (
                    "🚀 イシューを生成"
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">ℹ️ 使い方</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="badge badge-primary">1</div>
                  <div>
                    <h4 className="font-semibold">リポジトリを選択</h4>
                    <p className="text-sm text-gray-600">
                      イシューを作成したいGitHubリポジトリを選択します
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="badge badge-primary">2</div>
                  <div>
                    <h4 className="font-semibold">要件を記述</h4>
                    <p className="text-sm text-gray-600">
                      プロジェクトの要件をMarkdown形式で記述します
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="badge badge-primary">3</div>
                  <div>
                    <h4 className="font-semibold">生成・選択</h4>
                    <p className="text-sm text-gray-600">
                      AIがイシューを生成し、作成したいものを選択します
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="badge badge-primary">4</div>
                  <div>
                    <h4 className="font-semibold">イシュー作成</h4>
                    <p className="text-sm text-gray-600">
                      選択したイシューをリポジトリに作成します
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Generated Issues */}
        {generatedIssues.length > 0 && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-title">
                  🎯 生成されたイシュー ({generatedIssues.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={selectAllIssues}
                  >
                    {selectedIssues.size === generatedIssues.length
                      ? "すべて解除"
                      : "すべて選択"}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={createSelectedIssues}
                    disabled={
                      selectedIssues.size === 0 ||
                      creatingIssues ||
                      !selectedRepo
                    }
                  >
                    {creatingIssues ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        作成中...
                      </>
                    ) : (
                      `選択したイシューを作成 (${selectedIssues.size})`
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedIssues.map((issue, index) => (
                  <div
                    key={index}
                    className={`card cursor-pointer transition-all border-2 hover:shadow-lg ${
                      selectedIssues.has(index)
                        ? "border-primary bg-primary/10"
                        : "border-base-300 bg-base-100 hover:border-primary/50"
                    }`}
                    onClick={() => openPreviewModal(issue, index)}
                  >
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="card-title text-base leading-tight flex-1 pr-2">
                          {issue.title}
                        </h4>
                        <div className="flex items-center gap-1">
                          <button
                            className="btn btn-ghost btn-xs p-1"
                            onClick={(e) => openEditModal(issue, index, e)}
                            title="編集"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="w-4 h-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                              />
                            </svg>
                          </button>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-primary checkbox-sm"
                            checked={selectedIssues.has(index)}
                            onChange={(e) => toggleIssueSelection(index, e)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-2">
                        {issue.labels.map((label) => (
                          <div
                            key={label}
                            className="badge badge-outline badge-sm"
                          >
                            {label}
                          </div>
                        ))}
                        {issue.priority && (
                          <div className="badge badge-secondary badge-sm">
                            優先度{issue.priority}
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 line-clamp-3">
                        {issue.body.split("\n")[0]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedIssues.size > 0 && (
                <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                  <h4 className="font-semibold mb-2">選択中のイシュー</h4>
                  <ul className="text-sm space-y-1">
                    {Array.from(selectedIssues).map((index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                        {generatedIssues[index].title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewModal.isOpen && previewModal.issue && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              {previewModal.issue.title}
            </h3>

            <div className="flex flex-wrap gap-1 mb-4">
              {previewModal.issue.labels.map((label) => (
                <div key={label} className="badge badge-primary">
                  {label}
                </div>
              ))}
              {previewModal.issue.priority && (
                <div className="badge badge-secondary">
                  優先度 {previewModal.issue.priority}
                </div>
              )}
            </div>

            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-4 rounded">
                {previewModal.issue.body}
              </pre>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (previewModal.index !== null && previewModal.issue) {
                    closePreviewModal(); // まずプレビューモーダルを閉じる
                    openEditModal(previewModal.issue, previewModal.index); // eventパラメータなしで呼び出し
                  }
                }}
              >
                編集
              </button>
              <button className="btn" onClick={closePreviewModal}>
                閉じる
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closePreviewModal}></div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.isOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">イシューを編集</h3>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">タイトル</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={editingIssue.title}
                onChange={(e) =>
                  setEditingIssue({ ...editingIssue, title: e.target.value })
                }
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">本文</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full h-40"
                value={editingIssue.body}
                onChange={(e) =>
                  setEditingIssue({ ...editingIssue, body: e.target.value })
                }
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">ラベル</span>
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {editingIssue.labels.map((label) => (
                  <div key={label} className="badge badge-primary gap-1">
                    {label}
                    <button
                      className="btn btn-ghost btn-xs p-0"
                      onClick={() => removeLabel(label)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="join">
                <input
                  type="text"
                  className="input input-bordered join-item flex-1"
                  placeholder="新しいラベルを追加"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addLabel(e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
                <button
                  className="btn btn-primary join-item"
                  onClick={(e) => {
                    const input = e.currentTarget
                      .previousElementSibling as HTMLInputElement;
                    addLabel(input.value);
                    input.value = "";
                  }}
                >
                  追加
                </button>
              </div>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">優先度 (1:高 ← → 5:低)</span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                value={editingIssue.priority || 1}
                className="range range-primary"
                step="1"
                onChange={(e) =>
                  setEditingIssue({
                    ...editingIssue,
                    priority: parseInt(e.target.value),
                  })
                }
              />
              <div className="w-full flex justify-between text-xs px-2">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
              <div className="text-center mt-1">
                <span className="badge badge-secondary">
                  優先度 {editingIssue.priority}
                </span>
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={closeEditModal}>
                キャンセル
              </button>
              <button className="btn btn-primary" onClick={saveEditedIssue}>
                保存
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeEditModal}></div>
        </div>
      )}
    </div>
  );
}

export default App;
