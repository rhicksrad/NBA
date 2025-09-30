var C=new URL("./data/rosters.json",document.baseURI).toString();async function B(){let e=await fetch(C,{cache:"no-store"});if(!e.ok)throw new Error(`Request failed with status ${e.status}`);return await e.json()}var f=document.getElementById("players-app");if(!f)throw new Error("Missing #players-app container");var F=new URLSearchParams(window.location.search),j,k=((j=F.get("team"))!=null?j:"").toUpperCase(),E,q=(E=F.get("search"))!=null?E:"",r={doc:null,loading:!0,error:null,searchTerm:q,teamFilter:k,anchorApplied:!1};function p(e){return e.replace(/[&<>"']/g,t=>{switch(t){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case'"':return"&quot;";case"'":return"&#39;";default:return t}})}function O(e){let t=Date.parse(e);if(Number.isNaN(t))return e;let s=Date.now(),a=Math.round((t-s)/1e3),o=[{amount:60,unit:"second"},{amount:60,unit:"minute"},{amount:24,unit:"hour"},{amount:7,unit:"day"},{amount:4.34524,unit:"week"},{amount:12,unit:"month"},{amount:Number.POSITIVE_INFINITY,unit:"year"}],l=new Intl.RelativeTimeFormat("en",{numeric:"auto"}),i=a;for(let u of o){if(Math.abs(i)<u.amount)return l.format(Math.round(i),u.unit);i/=u.amount}return l.format(Math.round(i),"year")}function V(e,t){if(!t)return!0;let s=t.toLowerCase(),a=e.name.toLowerCase(),o=e.jersey?`#${e.jersey}`.toLowerCase():"";return a.includes(s)||o.includes(s)}function y(e){let t=new URL(window.location.href);Object.entries(e).forEach(([s,a])=>{a&&a.length?t.searchParams.set(s,a):t.searchParams.delete(s)}),window.history.replaceState({},"",t.toString())}function x(e){var s;let t=(s=e.source)==null?void 0:s.trim().toLowerCase();return t==="ball_dont_lie"?"Primary league data feed":t==="manual_roster_reference"?"Manual roster reference":e.source&&e.source.trim().length?e.source.trim():"Unknown"}function Y(e){var s;let t=(s=e.season)==null?void 0:s.trim();if(t)return t;if(typeof e.season_start_year=="number"&&Number.isFinite(e.season_start_year)){let a=e.season_start_year,o=String(a+1).slice(-2);return`${a}-${o}`}return"2025-26"}function z(e){return e.abbr==="FA"?"Free agents":e.name||e.abbr}function G(e,t){return e==="FA"&&t!=="FA"?1:t==="FA"&&e!=="FA"?-1:e.localeCompare(t)}function J(e,t){var o,l,i,u,d,h;let s=((o=e.abbreviation)==null?void 0:o.trim().toUpperCase())||"FA",a=((l=e.full_name)==null?void 0:l.trim())||s;return{id:t.id,name:`${t.first_name} ${t.last_name}`.trim(),team_abbr:s,team_name:a,position:(i=t.position)!=null?i:null,jersey:(u=t.jersey_number)!=null?u:null,height:(d=t.height)!=null?d:null,weight:(h=t.weight)!=null?h:null}}function K(e){var s,a;let t=[];for(let o of Array.isArray(e.teams)?e.teams:[]){let l=((s=o.abbreviation)==null?void 0:s.trim().toUpperCase())||"FA",i=((a=o.full_name)==null?void 0:a.trim())||l,u=(Array.isArray(o.roster)?o.roster:[]).map(d=>J(o,d)).sort((d,h)=>d.name.localeCompare(h.name));t.push({abbr:l,name:i,players:u})}return t.sort((o,l)=>G(o.abbr,l.abbr))}function Q(){f.innerHTML=`
    <div class="roster-status">
      <p>Loading active rosters\u2026</p>
    </div>
  `}function W(e){f.innerHTML=`
    <div class="roster-status roster-status--error">
      <p>${p(e)}</p>
      <button type="button" class="roster-button" data-roster-retry>Retry</button>
    </div>
  `;let t=f.querySelector("[data-roster-retry]");t&&t.addEventListener("click",()=>_())}function X(e){let t=K(e),s=r.teamFilter;s&&!t.some(n=>n.abbr===s)&&(r.teamFilter="",y({team:null}));let a=r.teamFilter,o=t.filter(n=>!a||n.abbr===a),l=["",...t.map(n=>n.abbr)],i=t.length>0,u=i?O(e.fetched_at):"not yet available",d=i?new Date(e.fetched_at).toLocaleString():"No roster snapshot cached yet",h=x(e),M=Y(e),I=[`Last updated: ${u}`,`Source: ${p(h)}`,`Season: ${p(M)}`],P=`
    <div class="roster-controls">
      <div class="roster-controls__filters">
        <label class="roster-controls__field">
          <span class="roster-controls__label">Search</span>
          <input
            id="roster-search"
            class="roster-input"
            type="search"
            placeholder="Search by name or jersey"
            value="${p(r.searchTerm)}"
            autocomplete="off"
          />
        </label>
        <label class="roster-controls__field">
          <span class="roster-controls__label">Team</span>
          <select id="roster-team" class="roster-select">
            ${l.map(n=>{let c=n||"All teams",T=n===a?"selected":"";return`<option value="${n}">${c}</option>`}).join("")}
          </select>
        </label>
      </div>
      <div class="roster-controls__meta">
        <small title="${d}">
          ${I.join(" \u2022 ")}
        </small>
        <button type="button" class="roster-button" data-roster-refresh>Refresh</button>
      </div>
    </div>
  `,U=o.map(n=>{let c=n.players.filter(m=>V(m,r.searchTerm)),T=c.map(m=>{var S,A;let N=m.jersey?`#${m.jersey}`:"",$=[(S=m.position)!=null?S:"",N].filter(Boolean).join(" \xB7 "),L=[(A=m.height)!=null?A:"",m.weight?`${m.weight} lbs`:""].filter(Boolean).join(" \u2022 ");return`
            <li class="roster-player">
              <span class="roster-player__name">${p(m.name)}</span>
              ${$?`<span class="roster-player__role">${p($)}</span>`:""}
              ${L?`<span class="roster-player__meta">${p(L)}</span>`:""}
            </li>
          `}).join(""),D=c.length?"":'<li class="roster-player roster-player--empty">No players match this filter.</li>',H=`${p(z(n))} \xB7 ${c.length} players`;return`
        <section class="roster-team" data-team-anchor="${n.abbr}">
          <header class="roster-team__header">
            <h3 id="team-${n.abbr}">${n.abbr}</h3>
            <p>${H}</p>
          </header>
          <ul class="roster-list">
            ${T||D}
          </ul>
        </section>
      `}).join(""),b="";i?o.length||(b='<div class="roster-status roster-status--empty"><p>No teams match the current filter.</p></div>'):b='<div class="roster-status roster-status--empty"><p>Rosters are not cached yet. Use Refresh to try again.</p></div>',f.innerHTML=`${P}<div class="roster-teams">${U}${b}</div>`;let w=document.getElementById("roster-search"),R=document.getElementById("roster-team"),v=f.querySelector("[data-roster-refresh]");if(w&&w.addEventListener("input",n=>{let c=n.target.value;r.searchTerm=c,y({search:c}),g()}),R&&R.addEventListener("change",n=>{let c=n.target.value.toUpperCase();r.teamFilter=c,r.anchorApplied=!c,y({team:c}),g()}),v&&v.addEventListener("click",()=>_()),!r.anchorApplied&&r.teamFilter){let n=f.querySelector(`[data-team-anchor="${r.teamFilter}"]`);n&&(n.scrollIntoView({behavior:"smooth",block:"start"}),r.anchorApplied=!0)}}function g(){if(r.loading){Q();return}if(r.error){W(r.error);return}r.doc&&X(r.doc)}async function _(){r.loading=!0,r.error=null,g();try{let e=await B();if(!e||!Array.isArray(e.teams))throw new Error("Malformed roster payload");r.doc=e,r.loading=!1,g()}catch(e){r.loading=!1,r.error=e instanceof Error?e.message:"Unable to load players.",g()}}_();
