import { useState } from "react";
import {
  Plus,
  Filter,
  Search,
  ChevronRight,
  Target,
  Archive,
  Trash2,
  CheckCircle2,
  Circle,
  PauseCircle,
  MoreHorizontal,
  Settings,
  History,
  BookOpen,
  Plug,
} from "lucide-react";
import { tr } from "./i18n";
import { Button, Notice } from "./ui";
export function FunctionDirectory({
  functions,
  selectedId,
  onSelect,
  onNew,
  onUpdate,
  onDelete,
  busy,
  loading,
  error,
  retry,
  onSettings,
  onRuns,
  onApi,
  onConnections,
  connectionsActive,
  port,
}: any) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [primitive, setPrimitive] = useState("all"),
    [filters, setFilters] = useState(false),
    [groups, setGroups] = useState<Record<string, boolean>>({
      current: true,
      archive: false,
      trash: false,
    });
  const matches = (f: any) =>
    `${f.display_name} ${f.function_key}`
      .toLowerCase()
      .includes(search.toLowerCase()) &&
    (primitive === "all" || f.primitives?.includes(primitive)) &&
    (status === "all" ||
      (status === "draft"
        ? !f.active_version
        : status === "published"
          ? !!f.active_version
          : !f.enabled));
  const sections = [
    {
      key: "current",
      label: "当前",
      Icon: Target,
      items: functions.filter((f: any) => !f.archived_at && !f.deleted_at),
    },
    {
      key: "archive",
      label: "归档",
      Icon: Archive,
      items: functions.filter((f: any) => f.archived_at && !f.deleted_at),
    },
    {
      key: "trash",
      label: "回收站",
      Icon: Trash2,
      items: functions.filter((f: any) => f.deleted_at),
    },
  ];
  return (
    <aside className="function-rail directory" aria-label={tr("函数列表")}>
      <div className="rail-brand">
        <span className="brand-symbol">j</span>
        <strong>Jev</strong>
        <span>Workbench</span>
      </div>
      <div className="directory-toolbar">
        <Button onClick={onNew} aria-label={tr("新增函数")}>
          <Plus size={17} />
          {tr("新建函数")}
        </Button>
        <Button
          aria-label={tr("筛选函数")}
          aria-expanded={filters}
          aria-pressed={filters}
          className={filters ? "filter-active" : ""}
          onClick={() => setFilters(!filters)}
        >
          <Filter size={18} />
          {(status !== "all" || primitive !== "all") && (
            <i className="filter-dot" />
          )}
        </Button>
      </div>
      <label className="rail-search">
        <Search size={15} />
        <input
          aria-label={tr("搜索函数")}
          placeholder={tr("搜索名称或 Key")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {filters && (
        <div className="directory-filters">
          <select
            aria-label={tr("状态筛选")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">{tr("全部状态")}</option>
            <option value="draft">{tr("草稿")}</option>
            <option value="published">{tr("已发布")}</option>
            <option value="disabled">{tr("已停用")}</option>
          </select>
          <select
            aria-label={tr("原语筛选")}
            value={primitive}
            onChange={(e) => setPrimitive(e.target.value)}
          >
            <option value="all">{tr("全部原语")}</option>
            <option value="noul">Noul</option>
            <option value="choice">Choice</option>
            <option value="score">Score</option>
          </select>
        </div>
      )}
      <div className="directory-groups">
        {loading && <p className="rail-empty">{tr("正在读取函数…")}</p>}
        {error && (
          <Notice error>
            {error.message}
            <Button onClick={retry}>{tr("重试")}</Button>
          </Notice>
        )}
        {sections.map(({ key, label, Icon, items }) => {
          const filtered = items.filter(matches),
            open = groups[key] || !!search;
          return (
            <section className="directory-group" key={key}>
              <button
                className={
                  "group-heading " + (key === "trash" ? "trash-heading" : "")
                }
                aria-expanded={open}
                onClick={() => setGroups({ ...groups, [key]: !groups[key] })}
              >
                <ChevronRight size={15} className={open ? "expanded" : ""} />
                <Icon size={17} />
                <span>{tr(label)}</span>
                <span className="group-count">{filtered.length}</span>
              </button>
              {open && (
                <div className="group-items">
                  {filtered.map((f: any) => {
                    const IconState = f.deleted_at
                      ? Trash2
                      : f.archived_at
                        ? Archive
                        : !f.enabled
                          ? PauseCircle
                          : f.active_version
                            ? CheckCircle2
                            : Circle;
                    const label = f.deleted_at
                      ? "已删除"
                      : f.archived_at
                        ? "已归档"
                        : !f.enabled
                          ? "已停用"
                          : f.active_version
                            ? "已发布"
                            : "草稿";
                    return (
                      <div
                        className={
                          "function-item directory-item " +
                          (selectedId === f.id ? "active" : "")
                        }
                        key={f.id}
                      >
                        <button
                          className="function-select"
                          aria-current={
                            selectedId === f.id ? "true" : undefined
                          }
                          title={`${f.display_name}\n${f.function_key}`}
                          onClick={() => onSelect(f.id)}
                        >
                          <span className="directory-name">
                            {f.display_name}
                          </span>
                          <span className="type-tags">
                            {(f.primitives ?? []).map((p: string) => (
                              <span
                                key={p}
                                className={"primitive-tag type-" + p}
                              >
                                {p[0].toUpperCase() + p.slice(1)}
                              </span>
                            ))}
                          </span>
                          <span
                            className={
                              "directory-status " +
                              (label === "已发布"
                                ? "published"
                                : label === "已删除"
                                  ? "deleted"
                                  : label === "草稿"
                                    ? "draft"
                                    : label === "已停用"
                                      ? "disabled"
                                      : label === "已归档"
                                        ? "archived"
                                        : "")
                            }
                          >
                            <IconState size={13} />
                            <span>{tr(label)}</span>
                          </span>
                        </button>
                        <details className="item-menu">
                          <summary
                            aria-label={tr("函数操作 ") + f.display_name}
                          >
                            <MoreHorizontal size={15} />
                          </summary>
                          <div>
                            {f.deleted_at ? (
                              <>
                                <button
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.currentTarget.closest("details")!.open =
                                      false;
                                    onUpdate(f, { trashed: false });
                                  }}
                                >
                                  {tr("恢复函数")}
                                </button>
                                <button
                                  className="danger"
                                  onClick={(e) => {
                                    e.currentTarget.closest("details")!.open =
                                      false;
                                    onDelete(f);
                                  }}
                                >
                                  {tr("永久删除")}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.currentTarget.closest("details")!.open =
                                      false;
                                    onUpdate(f, { enabled: !f.enabled });
                                  }}
                                >
                                  {f.enabled ? tr("停用函数") : tr("启用函数")}
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.currentTarget.closest("details")!.open =
                                      false;
                                    onUpdate(f, { archived: !f.archived_at });
                                  }}
                                >
                                  {f.archived_at
                                    ? tr("恢复归档")
                                    : tr("归档函数")}
                                </button>
                                <button
                                  className="danger"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.currentTarget.closest("details")!.open =
                                      false;
                                    onUpdate(f, { trashed: true });
                                  }}
                                >
                                  {tr("移入回收站")}
                                </button>
                              </>
                            )}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                  {!loading && !error && !filtered.length && (
                    <p className="directory-empty">
                      {search || status !== "all" || primitive !== "all"
                        ? tr("没有匹配的函数")
                        : tr("暂无函数")}
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="rail-bottom">
        <Button
          className={connectionsActive ? "nav-active" : ""}
          onClick={onConnections}
        >
          <Plug size={16} />
          {tr("调用与接入")}
        </Button>
        <Button onClick={onApi}>
          <BookOpen size={16} />
          {tr("接口文档")}
        </Button>
        <Button onClick={onRuns}>
          <History size={16} />
          {tr("调用记录")}
        </Button>
        <Button onClick={onSettings}>
          <Settings size={16} />
          {tr("设置")}
        </Button>
        <small>127.0.0.1:{port}</small>
      </div>
    </aside>
  );
}
