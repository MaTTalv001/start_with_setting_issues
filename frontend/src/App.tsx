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
  const [howToUseModal, setHowToUseModal] = useState(false);

  // LLM関連の状態
  const [generatedIssues, setGeneratedIssues] = useState<GeneratedIssue[]>([]);
  const [markdownContent, setMarkdownContent] = useState("");
  const [generatingIssues, setGeneratingIssues] = useState(false);
  const [sampleMarkdown, setSampleMarkdown] = useState("");

  // ファイルアップロード関連の状態
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
      }
    } catch (error) {
      console.error("Failed to load sample markdown:", error);
    }
  };

  const handleGithubLogin = async () => {
    try {
      const response = await fetch("/api/config");
      const config = await response.json();
      const clientId = config.github_client_id;

      if (!clientId) {
        setError("GitHub Client IDが設定されていません");
        return;
      }

      const baseUrl = window.location.origin;
      const redirectUri = `${baseUrl}/api/auth/callback`;
      const scope = "user:email repo";
      const state = Math.random().toString(36).substring(7);

      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
      window.location.href = githubAuthUrl;
    } catch (error) {
      setError("設定の取得に失敗しました");
    }
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
      setMarkdownContent("");
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

  // ファイル読み込み処理
  const readFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          resolve(result);
        } else {
          reject(new Error("ファイルの読み込みに失敗しました"));
        }
      };
      reader.onerror = () =>
        reject(new Error("ファイルの読み込みに失敗しました"));
      reader.readAsText(file, "UTF-8");
    });
  };

  // ファイルバリデーション
  const validateFile = (file: File): boolean => {
    const allowedExtensions = [".md", ".txt", ".markdown"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    // 拡張子チェック
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some((ext) =>
      fileName.endsWith(ext)
    );

    if (!hasValidExtension) {
      setUploadError("対応ファイル形式: .md, .txt, .markdown");
      return false;
    }

    // ファイルサイズチェック
    if (file.size > maxSize) {
      setUploadError("ファイルサイズは5MB以下にしてください");
      return false;
    }

    setUploadError(null);
    return true;
  };

  // ファイル処理
  const handleFileUpload = async (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    try {
      const content = await readFile(file);
      setMarkdownContent(content);
      setUploadError(null);
    } catch (error) {
      setUploadError("ファイルの読み込みに失敗しました");
      console.error("File reading error:", error);
    }
  };

  // ドラッグ&ドロップ処理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // ファイル選択処理
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
    // ファイル選択をリセット（同じファイルを再選択できるように）
    e.target.value = "";
  };

  // サンプルマークダウン読み込み
  const loadSampleContent = () => {
    setMarkdownContent(sampleMarkdown);
    setUploadError(null);
  };

  // フォームクリア
  const clearContent = () => {
    setMarkdownContent("");
    setUploadError(null);
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
        <div className="hero min-h-screen bg-white">
          <div className="hero-content text-center">
            <div className="max-w-2xl px-8">
              {/* 上部タイトル */}
              <div className="mb-4">
                <h1 className="text-3xl font-normal text-black mb-2">
                  イシューから定めよ
                </h1>
                <p className="text-sm text-gray-600 font-light">
                  要件定義からイシューを登録する
                </p>
              </div>

              {/* 中央メインタイトル */}
              <div className="my-16">
                <h2 className="text-7xl font-black text-black leading-tight">
                  ISSUE
                  <br />
                  SETTING
                </h2>
              </div>

              {/* ログイン案内 */}
              <div className="mb-8">
                <button
                  className="btn bg-black text-white border-black hover:bg-gray-800 hover:border-gray-800 px-8 py-3 text-base"
                  onClick={handleGithubLogin}
                >
                  GitHubログイン
                </button>
              </div>

              {/* 下部クレジット */}
              <div className="mt-16">
                <p className="text-xs text-gray-400 font-light">
                  respect for 「イシューからはじめよ」
                </p>
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
            IssueSetting
          </span>
        </div>

        <div className="navbar-end">
          <button
            className="btn btn-ghost btn-sm mr-4"
            onClick={() => setHowToUseModal(true)}
          >
            アプリの使い方
          </button>
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

        {/* Step 1: Repository Selection */}
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title mb-4">
              <span className="badge badge-primary">1</span>
              イシューを登録するリポジトリを選択してください
            </h2>

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

        {/* Step 2 & 3: Requirements Input and Issue Generation (Only show when repo is selected) */}
        {selectedRepo && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Step 2: Requirements Input */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title mb-4">
                  <span className="badge badge-primary">2</span>
                  イシューの元となる要件情報を入力してください
                </h3>

                {/* ファイルアップロードエリア */}
                <div className="mb-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                      isDragging
                        ? "border-primary bg-primary/10"
                        : "border-gray-300 hover:border-primary hover:bg-primary/5"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() =>
                      document.getElementById("file-upload")?.click()
                    }
                  >
                    <input
                      id="file-upload"
                      type="file"
                      accept=".md,.txt,.markdown"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">
                          クリックしてファイルを選択
                        </span>
                        または ドラッグ&ドロップ
                      </p>
                      <p className="text-xs text-gray-500">
                        対応形式: .md, .txt, .markdown (最大 5MB)
                      </p>
                    </div>
                  </div>

                  {uploadError && (
                    <div className="alert alert-error mt-2">
                      <span className="text-sm">{uploadError}</span>
                    </div>
                  )}
                </div>

                {/* テキストエリア */}
                <textarea
                  className="textarea textarea-bordered w-full h-64 font-mono text-sm"
                  placeholder="要件をMarkdown形式で入力するか、上記からファイルをアップロードしてください..."
                  value={markdownContent}
                  onChange={(e) => setMarkdownContent(e.target.value)}
                />

                {/* アクションボタン */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={loadSampleContent}
                    disabled={!sampleMarkdown}
                  >
                    サンプル要件を読み込み
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={clearContent}
                    disabled={!markdownContent.trim()}
                  >
                    クリア
                  </button>
                  <div className="flex-1"></div>
                  <button
                    className="btn btn-primary"
                    onClick={generateIssues}
                    disabled={
                      generatingIssues ||
                      !markdownContent.trim() ||
                      !selectedRepo
                    }
                  >
                    {generatingIssues ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        生成中...
                      </>
                    ) : (
                      "イシューを生成"
                    )}
                  </button>
                </div>

                {/* 文字カウント */}
                {markdownContent && (
                  <div className="text-xs text-gray-500 mt-2 text-right">
                    文字数: {markdownContent.length}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Generated Issues */}
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title mb-4">
                  <span className="badge badge-primary">3</span>
                  イシューを編集・選択してリポジトリに登録してください
                </h3>

                {generatedIssues.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>要件情報を入力してイシューを生成してください</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-600">
                        生成されたイシュー: {generatedIssues.length}個
                      </span>
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

                    <div className="space-y-3 max-h-96 overflow-y-auto">
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
                              <h4 className="card-title text-sm leading-tight flex-1 pr-2">
                                {issue.title}
                              </h4>
                              <div className="flex items-center gap-1">
                                <button
                                  className="btn btn-ghost btn-xs p-1"
                                  onClick={(e) =>
                                    openEditModal(issue, index, e)
                                  }
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
                                  onChange={(e) =>
                                    toggleIssueSelection(index, e)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1 mb-2">
                              {issue.labels.map((label) => (
                                <div
                                  key={label}
                                  className="badge badge-outline badge-xs"
                                >
                                  {label}
                                </div>
                              ))}
                              {issue.priority && (
                                <div className="badge badge-secondary badge-xs">
                                  優先度{issue.priority}
                                </div>
                              )}
                            </div>

                            <p className="text-xs text-gray-600 line-clamp-2">
                              {issue.body.split("\n")[0]}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedIssues.size > 0 && (
                      <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                        <h4 className="font-semibold mb-2 text-sm">
                          選択中のイシュー
                        </h4>
                        <ul className="text-xs space-y-1">
                          {Array.from(selectedIssues).map((index) => (
                            <li key={index} className="flex items-center gap-2">
                              <span className="w-1 h-1 bg-primary rounded-full"></span>
                              {generatedIssues[index].title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* How to Use Modal */}
      {howToUseModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">アプリの使い方</h3>

            <div className="mb-6">
              <h4 className="font-semibold mb-2">このアプリの目的</h4>
              <p className="text-sm text-gray-600 mb-4">
                「イシューから定めよ」は、プロジェクトの要件定義からAIを活用してGitHubイシューを自動生成し、
                効率的なプロジェクト管理を支援するツールです。要件をAIが適切な粒度のタスクに分解し、
                開発チームが即座に作業を開始できる状態にします。
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="badge badge-primary">1</div>
                <div>
                  <h4 className="font-semibold">リポジトリを選択</h4>
                  <p className="text-sm text-gray-600">
                    イシューを作成したいGitHubリポジトリを選択します。選択後、次のステップが表示されます。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="badge badge-primary">2</div>
                <div>
                  <h4 className="font-semibold">要件情報を入力</h4>
                  <p className="text-sm text-gray-600">
                    プロジェクトの要件をMarkdown形式で入力するか、ファイルをアップロードします。
                    詳細な要件ほど、より具体的なイシューが生成されます。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="badge badge-primary">3</div>
                <div>
                  <h4 className="font-semibold">イシューを編集・選択・登録</h4>
                  <p className="text-sm text-gray-600">
                    AIが生成したイシューを確認し、必要に応じて編集します。
                    作成したいイシューを選択して、リポジトリに一括登録できます。
                  </p>
                </div>
              </div>
            </div>

            <div className="alert alert-info mt-6">
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
              <div>
                <h3 className="font-bold">対応ファイル形式</h3>
                <div className="text-xs">.md, .txt, .markdown（最大5MB）</div>
              </div>
            </div>

            <div className="modal-action">
              <button className="btn" onClick={() => setHowToUseModal(false)}>
                閉じる
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setHowToUseModal(false)}
          ></div>
        </div>
      )}

      {/* 既存のPreview ModalとEdit Modalはそのまま */}
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
                    closePreviewModal();
                    openEditModal(previewModal.issue, previewModal.index);
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
