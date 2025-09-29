async function H(){let e=await fetch(`data/players_index.json?cb=${Date.now()}`);if(!e.ok)throw new Error(`Request failed with status ${e.status}`);return await e.json()}var u=document.getElementById("players-app");if(!u)throw new Error("Missing #players-app container");var S=new URLSearchParams(window.location.search),E,B=((E=S.get("team"))!=null?E:"").toUpperCase(),A,N=(A=S.get("search"))!=null?A:"",r={index:null,loading:!0,error:null,searchTerm:N,teamFilter:B,anchorApplied:!1};function m(e){return e.replace(/[&<>"']/g,t=>{switch(t){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case'"':return"&quot;";case"'":return"&#39;";default:return t}})}function U(e){let t=Date.parse(e);if(Number.isNaN(t))return e;let n=Date.now(),a=Math.round((t-n)/1e3),l=[{amount:60,unit:"second"},{amount:60,unit:"minute"},{amount:24,unit:"hour"},{amount:7,unit:"day"},{amount:4.34524,unit:"week"},{amount:12,unit:"month"},{amount:Number.POSITIVE_INFINITY,unit:"year"}],h=new Intl.RelativeTimeFormat("en",{numeric:"auto"}),c=a;for(let d of l){if(Math.abs(c)<d.amount)return h.format(Math.round(c),d.unit);c/=d.amount}return h.format(Math.round(c),"year")}function C(e,t){if(!t)return!0;let n=t.toLowerCase(),a=e.name.toLowerCase(),l=e.jersey?`#${e.jersey}`.toLowerCase():"";return a.includes(n)||l.includes(n)}function y(e){let t=new URL(window.location.href);Object.entries(e).forEach(([n,a])=>{a&&a.length?t.searchParams.set(n,a):t.searchParams.delete(n)}),window.history.replaceState({},"",t.toString())}function D(e){return e==="FA"?"Free agents":e}function k(e,t){return e==="FA"&&t!=="FA"?1:t==="FA"&&e!=="FA"?-1:e.localeCompare(t)}function q(e){let t=new Map;for(let n of e){let a=n.team_abbr||"FA",l=t.get(a);l?l.push(n):t.set(a,[n])}return[...t.entries()].map(([n,a])=>({abbr:n,players:a})).sort((n,a)=>k(n.abbr,a.abbr))}function O(){u.innerHTML=`
    <div class="roster-status">
      <p>Loading active rosters\u2026</p>
    </div>
  `}function V(e){u.innerHTML=`
    <div class="roster-status roster-status--error">
      <p>${m(e)}</p>
      <button type="button" class="roster-button" data-roster-retry>Retry</button>
    </div>
  `;let t=u.querySelector("[data-roster-retry]");t&&t.addEventListener("click",()=>g())}function Y(e){let t=q(e.players),n=r.teamFilter;n&&!t.some(s=>s.abbr===n)&&(r.teamFilter="",y({team:null}));let a=r.teamFilter,l=t.filter(s=>!a||s.abbr===a),h=["",...t.map(s=>s.abbr)],c=t.length>0,d=c?U(e.fetched_at):"not yet available",F=c?new Date(e.fetched_at).toLocaleString():"No roster snapshot cached yet",M=`
    <div class="roster-controls">
      <div class="roster-controls__filters">
        <label class="roster-controls__field">
          <span class="roster-controls__label">Search</span>
          <input
            id="roster-search"
            class="roster-input"
            type="search"
            placeholder="Search by name or jersey"
            value="${m(r.searchTerm)}"
            autocomplete="off"
          />
        </label>
        <label class="roster-controls__field">
          <span class="roster-controls__label">Team</span>
          <select id="roster-team" class="roster-select">
            ${h.map(s=>{let o=s||"All teams",T=s===a?"selected":"";return`<option value="${s}">${o}</option>`}).join("")}
          </select>
        </label>
      </div>
      <div class="roster-controls__meta">
        <small title="${F}">
          Last updated: ${d} \u2022 Source: BallDontLie
        </small>
        <button type="button" class="roster-button" data-roster-refresh>Refresh</button>
      </div>
    </div>
  `,j=l.map(s=>{let o=s.players.filter(i=>C(i,r.searchTerm)),T=o.map(i=>{var L,I;let x=i.jersey?`#${i.jersey}`:"",$=[(L=i.position)!=null?L:"",x].filter(Boolean).join(" \xB7 "),_=[(I=i.height)!=null?I:"",i.weight?`${i.weight} lb`:""].filter(Boolean).join(" \u2022 ");return`
            <li class="roster-player">
              <span class="roster-player__name">${m(i.name)}</span>
              ${$?`<span class="roster-player__role">${m($)}</span>`:""}
              ${_?`<span class="roster-player__meta">${m(_)}</span>`:""}
            </li>
          `}).join(""),P=o.length?"":'<li class="roster-player roster-player--empty">No players match this filter.</li>',R=`${m(D(s.abbr))} \xB7 ${o.length} players`;return`
        <section class="roster-team" data-team-anchor="${s.abbr}">
          <header class="roster-team__header">
            <h3 id="team-${s.abbr}">${s.abbr}</h3>
            <p>${R}</p>
          </header>
          <ul class="roster-list">
            ${T||P}
          </ul>
        </section>
      `}).join(""),f="";c?l.length||(f='<div class="roster-status roster-status--empty"><p>No teams match the current filter.</p></div>'):f='<div class="roster-status roster-status--empty"><p>Rosters are not cached yet. Use Refresh to try again.</p></div>',u.innerHTML=`${M}<div class="roster-teams">${j}${f}</div>`;let b=document.getElementById("roster-search"),w=document.getElementById("roster-team"),v=u.querySelector("[data-roster-refresh]");if(b&&b.addEventListener("input",s=>{let o=s.target.value;r.searchTerm=o,y({search:o}),p()}),w&&w.addEventListener("change",s=>{let o=s.target.value.toUpperCase();r.teamFilter=o,r.anchorApplied=!o,y({team:o}),p()}),v&&v.addEventListener("click",()=>g()),!r.anchorApplied&&r.teamFilter){let s=u.querySelector(`[data-team-anchor="${r.teamFilter}"]`);s&&(s.scrollIntoView({behavior:"smooth",block:"start"}),r.anchorApplied=!0)}}function p(){if(r.loading){O();return}if(r.error){V(r.error);return}r.index&&Y(r.index)}async function g(){r.loading=!0,r.error=null,p();try{let e=await H();if(!e||!Array.isArray(e.players))throw new Error("Malformed players index payload");r.index=e,r.loading=!1,p()}catch(e){r.loading=!1,r.error=e instanceof Error?e.message:"Unable to load players.",p()}}g();
