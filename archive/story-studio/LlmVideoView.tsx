import { Code2, Download, ExternalLink, Music2 } from 'lucide-react'
import { useState } from 'react'
import { StatusBadge } from '../components/StatusBadge'
import type { LlmVideoReference } from '../types'

function MvCandidates({ project }: { project: LlmVideoReference }) {
  const [selectedId, setSelectedId] = useState(project.generations?.[0]?.id)
  const selected = project.generations?.find(item => item.id === selectedId) ?? project.generations?.[0]
  if (!selected) return null
  return <section className="llm-mv-section" aria-label="MV 制作候选">
    <h3>MV 制作候选</h3>
    <div className="llm-mv-tabs" role="group" aria-label="选择 MV 版本">
      {project.generations?.map(item => <button type="button" key={item.id} aria-pressed={selected.id === item.id} onClick={() => setSelectedId(item.id)}>{item.label}</button>)}
    </div>
    <div className="llm-mv-title"><strong>{selected.label} · {selected.version}</strong><StatusBadge status={selected.status} /></div>
    <p>{selected.description}</p>
    {selected.src ? <video key={selected.id} className="llm-reference-player" aria-label={`${selected.id} ${selected.label}`} controls preload="metadata" playsInline src={selected.src} poster={selected.poster ?? undefined} /> : <p role="status">此候选未在当前设备提供。</p>}
    <div className="llm-reference-meta"><span>{selected.id}</span><span>{selected.width} × {selected.height} · {selected.frameRate} fps</span><span>{duration(selected.durationSeconds)}</span>{selected.src ? <a href={selected.src} download><Download size={15} /> 下载 MV</a> : null}</div>
    {selected.knownIssues.length > 0 ? <p className="llm-mv-notes">待审核：{selected.knownIssues.join('；')}</p> : null}
  </section>
}

function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function LlmVideoView({ references, projectId, onSelect }: {
  references: LlmVideoReference[]
  projectId?: string
  onSelect: (id: string) => void
}) {
  const ordered = [...references].sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }))
  const selected = references.find((item) => item.id === projectId) ?? ordered[0]
  return (
    <main className="view llm-video-view">
      <header className="llm-video-heading">
        <div><span className="llm-video-eyebrow"><Code2 size={16} /> LLM · CODE · VIDEO</span>
          <h1>LLM 视频</h1><p>用代码构建画面、动画与剪辑，从参考作品开始。</p></div>
        <span className="llm-video-count">{references.length} 个参考项目</span>
      </header>
      {!selected ? <div className="empty-state"><h2>还没有参考作品</h2><p>收录视频后，可以在这里观看原片、试听音轨。</p></div> : (
        <div className="llm-video-layout">
          <section className="llm-reference-list" aria-label="参考作品列表">
            <h2>参考作品</h2>
            {ordered.map((item) => <button type="button" key={item.id} className={`llm-reference-card ${selected.id === item.id ? 'is-active' : ''}`} aria-pressed={selected.id === item.id} onClick={() => onSelect(item.id)}>
              <div className="llm-reference-image">{item.poster ? <img src={item.poster} alt="" /> : <Code2 />}<span>{duration(item.video.durationSeconds)}</span></div>
              <div className="llm-reference-copy"><small>{item.id}</small><strong>{item.title}</strong><span>{item.uploader} · {item.video.height}p</span></div>
            </button>)}
          </section>
          <article className="llm-reference-detail" key={selected.id}>
            <div className="llm-reference-title"><div><small>{selected.id} · {selected.version}</small><h2>{selected.title}</h2></div><StatusBadge status={selected.status} /></div>
            <MvCandidates key={selected.id} project={selected} />
            <h3>参考原片</h3>
            {selected.video.src ? <video className="llm-reference-player" aria-label={`${selected.id} 参考原片`} controls preload="metadata" playsInline src={selected.video.src} poster={selected.poster ?? undefined} /> : <p role="status">原片未在当前设备提供。</p>}
            <div className="llm-reference-meta"><span>{selected.video.width} × {selected.video.height}</span><span>{duration(selected.video.durationSeconds)}</span><span>{selected.video.codec.toUpperCase()}</span><span>上传者：{selected.uploader}</span></div>
            <div className="llm-reference-links">
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> B 站原页面</a>
              {selected.projectUrl ? <a href={selected.projectUrl} target="_blank" rel="noreferrer"><Code2 size={15} /> 来源项目</a> : null}
              {selected.video.src ? <a href={selected.video.src} download><Download size={15} /> 下载原片</a> : null}
            </div>
            <section className="llm-audio-section" aria-labelledby="llm-audio-heading">
              <h3 id="llm-audio-heading"><Music2 size={18} /> 提取音频</h3>
              <p>完整原片音轨，保留音乐、对白与音效。</p>
              {selected.audio.map((audio) => <div className="llm-audio-row" key={audio.id}>
                <div><strong>{audio.label}</strong><small>{audio.sampleRate ? `${audio.sampleRate / 1000} kHz` : ''} · {audio.channels} 声道 · {duration(audio.durationSeconds)}</small></div>
                {audio.src ? <><audio controls preload="metadata" aria-label={audio.label} src={audio.src} /><a href={audio.src} download><Download size={15} /> 下载</a></> : <span>音频未在当前设备提供</span>}
              </div>)}
            </section>
            <details className="llm-reference-notes"><summary>来源与制作信息</summary>{selected.sourceTitle ? <p>原视频标题：{selected.sourceTitle}</p> : null}<p>{selected.description}</p><p>{selected.productionMethod}</p><small>权利状态：{selected.rightsStatus} · 项目内部参考</small></details>
          </article>
        </div>
      )}
    </main>
  )
}
