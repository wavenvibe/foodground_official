const screens = [
  ["home", "홈"], ["recipes", "레시피 목록"], ["recipe-detail", "레시피 상세"],
  ["ingredients", "식재료 목록"], ["ingredient-detail", "식재료 상세"],
  ["substitutes", "대체 식재료"], ["facilities", "제조시설 후보"],
  ["facility-detail", "시설 상세"], ["inquiry", "문의 준비"]
];

const indexNav = (active) => `<nav class="screen-index card" aria-label="시안 화면 이동">${screens.map(([id,label]) => `<a class="${id === active ? "active" : ""}" href="?screen=${id}">${label}</a>`).join("")}</nav>`;
const layout = (active, body) => `${body}<div class="container">${indexNav(active)}</div>`;
const pageHead = (eyebrow, title, description, action = "") => `<div class="page-head"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
const metric = (label, value) => `<div class="metric"><div class="metric-label"><span>${label}</span><b>${value}</b></div><div class="bar"><i style="width:${value}"></i></div></div>`;

const renderHome = () => layout("home", `
  <section class="hero"><div class="container hero-grid">
    <div><span class="eyebrow">FOOD DEVELOPMENT WORKSPACE</span><h1>레시피에서 <em>제조시설 문의</em>까지,<br>한 흐름으로 탐색하세요.</h1><p>레시피의 식재료와 영양정보를 확인하고, 대체 가능한 식재료를 비교한 뒤 조건에 맞는 제조시설 후보까지 이어서 검토합니다.</p><form class="hero-search"><input aria-label="통합 검색" placeholder="레시피 또는 식재료를 검색해보세요" value="고추장 제육볶음"><a class="button primary" href="?screen=recipe-detail">탐색 시작</a></form></div>
    <aside class="hero-panel"><h2>이번 작업의 진행 흐름</h2><div class="flow-mini"><div><span>레시피 선택</span><strong>고추장 제육볶음</strong></div><div><span>핵심 식재료</span><strong>돼지고기 · 고추장</strong></div><div><span>대체 후보</span><strong>영양·맛 지표 비교</strong></div><div><span>제조시설</span><strong>조건 근거 확인</strong></div><div><span>다음 행동</span><strong>문의문안 복사</strong></div></div></aside>
  </div></section>
  <div class="container">
    <section class="flow-strip" aria-label="제품화 흐름"><article class="flow-step"><b>STEP 01</b><strong>레시피</strong><span>구성·분량 확인</span></article><article class="flow-step"><b>STEP 02</b><strong>식재료</strong><span>영양·연결 확인</span></article><article class="flow-step"><b>STEP 03</b><strong>대체 식재료</strong><span>점수·차이 비교</span></article><article class="flow-step"><b>STEP 04</b><strong>제조시설 후보</strong><span>조건·근거 검토</span></article><article class="flow-step"><b>STEP 05</b><strong>문의 준비</strong><span>문안 복사·연락</span></article></section>
    <section class="section"><div class="section-title"><div><h2>실제 데이터로 시작하는 탐색</h2><p>수치 자랑이 아니라 사용자가 바로 다음 결정을 할 수 있게 연결합니다.</p></div></div><div class="data-grid"><article class="card data-card"><span class="tag green">RECIPE</span><div class="number">70,165</div><p>구성 식재료와 분량을 확인할 수 있는 레시피</p></article><article class="card data-card"><span class="tag green">INGREDIENT</span><div class="number">18,932</div><p>영양정보·연결 레시피를 탐색하는 공개 식재료</p></article><article class="card data-card"><span class="tag green">FACILITY</span><div class="number">94,723</div><p>지역·업종·시설 HACCP 보유 여부로 찾는 제조시설</p></article></div></section>
  </div>`);

const renderRecipes = () => layout("recipes", `<div class="container page">${pageHead("STEP 01 · RECIPE", "레시피에서 개발 단서를 찾습니다", "요리명과 분류로 찾고, 구성 식재료에서 대체 검토를 시작합니다.")}
  <form class="filter-bar card"><div class="field"><label>레시피 검색</label><input value="고추장" aria-label="레시피 검색"></div><div class="field"><label>대분류</label><select><option>전체 분류</option><option selected>육류</option></select></div><div class="field"><label>정렬</label><select><option>관련도순</option><option>이름순</option></select></div><button class="button primary">검색</button></form>
  <div class="section-title"><div><h2>검색 결과</h2><p>총 128개 · 페이지 1/7</p></div><span class="pill">20개씩 보기</span></div>
  <section class="list"><article class="card list-card"><div><span class="tag green">육류</span><h3>고추장 제육볶음</h3><p>돼지고기·고추장·양파 등 11개 식재료로 구성된 볶음 요리</p><div class="list-meta"><span class="pill">식재료 11개</span><span class="pill">중량정보 9개</span><span class="pill green">대체 탐색 가능</span></div></div><div class="list-actions"><a class="button" href="?screen=recipe-detail">레시피 보기</a></div></article>
  <article class="card list-card"><div><span class="tag">육류</span><h3>고추장 불고기</h3><p>돼지고기와 채소를 고추장 양념에 볶아내는 레시피</p><div class="list-meta"><span class="pill">식재료 13개</span><span class="pill">중량정보 10개</span></div></div><div class="list-actions"><a class="button secondary" href="?screen=recipe-detail">레시피 보기</a></div></article>
  <article class="card list-card"><div><span class="tag">밑반찬</span><h3>고추장 멸치볶음</h3><p>멸치와 고추장 양념을 활용한 저장형 반찬 레시피</p><div class="list-meta"><span class="pill">식재료 8개</span><span class="pill">중량정보 8개</span></div></div><div class="list-actions"><a class="button secondary" href="?screen=recipe-detail">레시피 보기</a></div></article></section>
  </div>`);

const renderRecipeDetail = () => layout("recipe-detail", `<div class="container page"><div class="breadcrumb">레시피 / 육류 / 고추장 제육볶음</div><div class="two-col">
    <section><article class="card detail-hero"><div><span class="tag green">STEP 01 · 선택한 레시피</span><h1>고추장 제육볶음</h1><p>레시피를 읽고 끝나는 화면이 아니라, 각 식재료의 영양정보와 대체 후보로 이어지는 작업 화면입니다.</p></div><div class="fact-grid"><div class="fact"><span>분류</span><strong>육류 · 볶음</strong></div><div class="fact"><span>구성 식재료</span><strong>11개</strong></div><div class="fact"><span>중량정보</span><strong>9개 확인</strong></div></div></article>
    <section class="card card-pad section"><div class="section-title"><div><h2>구성 식재료</h2><p>대체 검토할 식재료를 선택하세요.</p></div></div><div class="ingredient-row"><div><strong>돼지고기 앞다리살</strong><small>주재료 · 육류</small></div><span>300 g</span><a class="button small secondary" href="?screen=ingredient-detail">상세 보기</a></div><div class="ingredient-row"><div><strong>고추장</strong><small>양념 · 장류</small></div><span>45 g</span><a class="button small primary" href="?screen=ingredient-detail">대체 검토</a></div><div class="ingredient-row"><div><strong>양파</strong><small>부재료 · 채소류</small></div><span>120 g</span><a class="button small secondary" href="?screen=ingredient-detail">상세 보기</a></div><div class="ingredient-row"><div><strong>대파</strong><small>부재료 · 채소류</small></div><span>40 g</span><a class="button small secondary" href="?screen=ingredient-detail">상세 보기</a></div></section></section>
    <aside class="sticky-panel"><div class="context-card"><h3>현재 작업 맥락</h3><p>레시피 ‘고추장 제육볶음’을 기준으로 고추장의 대체재를 검토하면, 이후 제조시설 후보 화면까지 이 조건이 유지됩니다.</p></div><div class="card card-pad section"><span class="eyebrow">NEXT ACTION</span><h2>고추장을 검토할까요?</h2><p class="muted small">영양·정미·이화학 지표가 준비된 후보를 비교합니다.</p><a class="button primary" href="?screen=ingredient-detail" style="width:100%;margin-top:12px">식재료 허브로 이동</a></div></aside>
  </div></div>`);

const renderIngredients = () => layout("ingredients", `<div class="container page">${pageHead("STEP 02 · INGREDIENT", "식재료를 데이터 허브로 사용합니다", "단순 이름 검색이 아니라 영양정보·연결 레시피·대체 후보를 한곳에서 확인합니다.")}
  <form class="filter-bar card"><div class="field"><label>식재료 검색</label><input value="고추장" aria-label="식재료 검색"></div><div class="field"><label>식품군</label><select><option>전체 식품군</option><option selected>조미료류</option></select></div><div class="field"><label>연결 상태</label><select><option selected>전체</option><option>영양정보 있음</option></select></div><button class="button primary">검색</button></form>
  <div class="section-title"><div><h2>검색 결과</h2><p>표준 식품과 연결된 재료는 영양·대체 분석을 함께 제공합니다.</p></div></div><section class="list"><article class="card list-card"><div><div class="list-meta"><span class="tag green">표준 식품 연결</span><span class="tag">조미료류</span></div><h3>고추장</h3><p>100g 영양성분 확인 가능 · 레시피 3,824건에서 사용</p><div class="list-meta"><span class="pill green">대체 후보 있음</span><span class="pill">영양 7개 항목</span><span class="pill">연결 레시피 3,824</span></div></div><div class="list-actions"><a class="button" href="?screen=ingredient-detail">식재료 허브 보기</a></div></article>
  <article class="card list-card"><div><div class="list-meta"><span class="tag">원재료명</span><span class="tag">조미료류</span></div><h3>태양초 고추장</h3><p>표준 식품 ‘고추장’과 포함일치로 연결 · 출처를 확인한 뒤 사용</p><div class="list-meta"><span class="pill">포함일치</span><span class="pill">연결 레시피 128</span></div></div><div class="list-actions"><a class="button secondary" href="?screen=ingredient-detail">연결 근거 보기</a></div></article></section>
  </div>`);

const renderIngredientDetail = () => layout("ingredient-detail", `<div class="container page"><div class="breadcrumb">레시피: 고추장 제육볶음 / 식재료: 고추장</div><div class="two-col">
    <section><article class="card detail-hero"><div><div class="list-meta"><span class="tag green">표준 식품 연결</span><span class="tag">조미료류</span></div><h1>고추장</h1><p>이 식재료가 어디에 쓰이고 어떤 영양 특성이 있는지 확인한 뒤, 기존 대체 식재료 비교 기능으로 이동합니다.</p></div><div class="fact-grid"><div class="fact"><span>연결 방식</span><strong>완전일치</strong></div><div class="fact"><span>연결 레시피</span><strong>3,824건</strong></div><div class="fact"><span>분석 가능</span><strong>6개 유사도</strong></div></div></article>
    <section class="card card-pad section"><div class="section-title"><div><h2>100g 기준 영양정보</h2><p>서로 다른 식재료를 같은 기준으로 비교합니다.</p></div></div><div class="nutrition-grid"><div class="fact"><span>에너지</span><strong>130 kcal</strong></div><div class="fact"><span>탄수화물</span><strong>29.3 g</strong></div><div class="fact"><span>단백질</span><strong>4.9 g</strong></div><div class="fact"><span>지방</span><strong>1.1 g</strong></div><div class="fact"><span>나트륨</span><strong>2,760 mg</strong></div><div class="fact"><span>수분</span><strong>47.2 g</strong></div></div></section>
    <section class="card card-pad section"><div class="section-title"><div><h2>이 식재료가 쓰인 레시피</h2><p>연결된 레시피에서 실제 사용 맥락을 확인합니다.</p></div></div><div class="ingredient-row"><div><strong>고추장 제육볶음</strong><small>육류 · 볶음</small></div><span>45 g</span><a class="button small secondary" href="?screen=recipe-detail">보기</a></div><div class="ingredient-row"><div><strong>고추장 불고기</strong><small>육류 · 볶음</small></div><span>50 g</span><a class="button small secondary" href="?screen=recipe-detail">보기</a></div></section></section>
    <aside class="sticky-panel"><div class="context-card"><h3>레시피 맥락 유지</h3><p>‘고추장 제육볶음’에 사용된 고추장을 검토 중입니다. 대체 후보를 선택하면 이 레시피와 선택한 후보가 제조시설 검색조건으로 이어집니다.</p></div><div class="card card-pad section"><span class="eyebrow">STEP 03</span><h2>대체 후보 비교</h2><p class="muted small">현재 마음에 드신 목록형 비교 UI를 그대로 유지합니다.</p><a class="button primary" href="?screen=substitutes" style="width:100%;margin-top:12px">대체 식재료 찾기</a></div></aside>
  </div></div>`);

const candidate = (name, score, type, values, isTop = false) => `<article class="card candidate"><div class="candidate-head"><div><div class="list-meta"><span class="tag ${isTop ? "green" : ""}">${isTop ? "추천 1순위" : "대체 후보"}</span><span class="tag">${type}</span></div><h3>${name}</h3><p>100g 기준 비교 · 활용 전 배합비와 알레르기·공정조건 확인 필요</p></div><div class="score">${score}</div></div><div class="metric-grid">${metric("영양성분 유사도", values[0])}${metric("정미성분 유사도", values[1])}${metric("맛 유사도", values[2])}${metric("이화학 유사도", values[3])}${metric("가격 유사도", values[4])}${metric("종합 유사도", values[5])}</div><table class="comparison"><thead><tr><th>100g 기준</th><th>기준: 고추장</th><th>후보: ${name}</th><th>차이</th></tr></thead><tbody><tr><td>에너지</td><td>130 kcal</td><td>${name === "된장" ? "125" : "139"} kcal</td><td>${name === "된장" ? "-5" : "+9"}</td></tr><tr><td>단백질</td><td>4.9 g</td><td>${name === "된장" ? "11.8" : "4.1"} g</td><td>${name === "된장" ? "+6.9" : "-0.8"}</td></tr><tr><td>나트륨</td><td>2,760 mg</td><td>${name === "된장" ? "3,640" : "2,410"} mg</td><td>${name === "된장" ? "+880" : "-350"}</td></tr></tbody></table><div class="action-row"><a class="button secondary small" href="?screen=ingredient-detail">후보 상세</a><a class="button primary small" href="?screen=facilities">이 후보로 시설 찾기</a></div></article>`;

const renderSubstitutes = () => layout("substitutes", `<div class="container page">${pageHead("STEP 03 · SUBSTITUTE", "대체 식재료를 근거와 함께 비교합니다", "현재 구현된 목록형 비교 구조·점수 정렬·6개 지표·100g 영양 비교를 유지합니다.")}
  <form class="search-stage card"><input value="고추장" aria-label="대체 식재료 검색"><button class="button primary">대체 후보 찾기</button></form>
  <article class="source-summary card"><div><span class="tag green">완전일치 · EXACT</span><h2>기준 식품: 고추장</h2><p>레시피 ‘고추장 제육볶음’의 식재료에서 시작 · 종합점수 내림차순</p></div><div class="score-bubble"><div><small>후보 수</small>10개</div></div></article>
  <div class="notice"><strong>이용 전 확인:</strong> 유사도는 대체 가능성을 검토하기 위한 참고정보입니다. 실제 배합비, 알레르기, 관능, 원가와 제조공정은 별도로 확인해야 합니다.</div>
  <section class="section">${candidate("된장", "0.91", "발효 장류", ["94%","82%","91%","88%","75%","91%"], true)}${candidate("혼합장", "0.87", "혼합 장류", ["91%","79%","88%","86%","81%","87%"])}${candidate("쌈장", "0.83", "조미 장류", ["88%","76%","85%","80%","78%","83%"])}</section>
  </div>`);

const renderFacilities = () => layout("facilities", `<div class="container page">${pageHead("STEP 04 · FACILITY", "선택 조건에 맞는 제조시설 후보를 검토합니다", "단순 업체 나열이 아니라 레시피·식재료 맥락과 시설 공개정보를 함께 보여줍니다.")}
  <div class="context-card"><h3>현재 선택 조건</h3><p>레시피: 고추장 제육볶음 · 대체 후보: 된장 · 필요 공정: 소스류 혼합·가열 · 지역: 전국</p></div>
  <form class="filter-bar card section"><div class="field"><label>업체명·지역 검색</label><input placeholder="업체명 또는 지역"></div><div class="field"><label>업종</label><select><option>전체 업종</option><option selected>식품제조가공업</option></select></div><div class="field"><label>시설 HACCP 보유</label><select><option>전체</option><option selected>보유 시설</option></select></div><button class="button primary">조건 적용</button></form>
  <div class="notice"><strong>HACCP 표시 경계:</strong> 아래 표시는 해당 시설의 인증 보유 여부입니다. 선택한 제품·공정에 적합하다는 판정이 아닙니다.</div>
  <section class="list section"><article class="card facility-card"><div><div class="list-meta"><span class="tag green">시설 HACCP 보유</span><span class="tag">식품제조가공업</span><span class="tag">경기도</span></div><h3>푸드파트너 제조센터</h3><p>경기도 화성시 · 영업상태 정상</p><div class="match-reasons"><div class="match-reason"><b>01</b><span>소스류 생산 이력이 있는 업종 분류</span></div><div class="match-reason"><b>02</b><span>선택 지역과 시설 공개정보가 일치</span></div><div class="match-reason"><b>03</b><span>시설 HACCP 보유 정보 확인</span></div></div></div><div class="facility-actions"><a class="button" href="?screen=facility-detail">시설 상세 보기</a><a class="button secondary" href="?screen=inquiry">문의 준비</a></div></article>
  <article class="card facility-card"><div><div class="list-meta"><span class="tag">시설 HACCP 미확인</span><span class="tag">식품제조가공업</span><span class="tag">충청북도</span></div><h3>한결식품 생산소</h3><p>충청북도 음성군 · 영업상태 정상</p><div class="match-reasons"><div class="match-reason"><b>01</b><span>장류·소스 관련 업종 분류</span></div><div class="match-reason"><b>02</b><span>전화·홈페이지 공개정보 확인 가능</span></div></div></div><div class="facility-actions"><a class="button secondary" href="?screen=facility-detail">시설 상세 보기</a></div></article></section>
  </div>`);

const renderFacilityDetail = () => layout("facility-detail", `<div class="container page"><div class="breadcrumb">고추장 제육볶음 / 된장 대체안 / 제조시설 후보</div><div class="two-col">
    <section><article class="card detail-hero"><div><div class="list-meta"><span class="tag green">시설 HACCP 보유</span><span class="tag">영업상태 정상</span></div><h1>푸드파트너 제조센터</h1><p>공개 제조시설 정보를 확인하고, 현재 개발 맥락을 담은 문의문안을 준비합니다.</p></div></article>
    <section class="card card-pad section"><div class="section-title"><div><h2>시설 공개정보</h2><p>공개 승인 컬럼만 표시합니다.</p></div></div><dl class="definition"><dt>관리번호</dt><dd>4100000-106-2020-00001</dd><dt>업종</dt><dd>식품제조가공업</dd><dt>지역</dt><dd>경기도 화성시</dd><dt>전화</dt><dd>031-000-0000</dd><dt>홈페이지</dt><dd>공개 홈페이지 연결</dd><dt>시설 HACCP</dt><dd>보유 · 제품·공정 적합 판정 아님</dd></dl></section>
    <section class="card card-pad section"><div class="section-title"><div><h2>후보로 제시된 이유</h2><p>확인된 사실과 사용자가 추가 확인할 항목을 분리합니다.</p></div></div><div class="match-reasons"><div class="match-reason"><b>확인</b><span>식품제조가공업이며 영업상태가 정상입니다.</span></div><div class="match-reason"><b>확인</b><span>시설 HACCP 보유 정보가 공개되어 있습니다.</span></div><div class="match-reason"><b>문의</b><span>소스류 혼합·가열 공정 가능 여부는 업체 확인이 필요합니다.</span></div><div class="match-reason"><b>문의</b><span>최소 생산수량·원가·납기는 공개자료에 없어 직접 문의해야 합니다.</span></div></div></section></section>
    <aside class="sticky-panel"><div class="contact-box card"><span class="eyebrow">STEP 05</span><h2>문의 준비</h2><p>시설 이메일은 공개 원본에 없습니다. 자동발송 대신 현재 선택조건이 담긴 문안을 복사하고 전화·홈페이지로 연락합니다.</p><a class="button primary" href="?screen=inquiry">문의문안 만들기</a><button class="button secondary">전화번호 복사</button></div><div class="notice">이 시설이 선택 제품을 제조할 수 있다는 확정 판정이 아닙니다. 제조 가능 공정과 인증 범위는 업체에 직접 확인하세요.</div></aside>
  </div></div>`);

const renderInquiry = () => layout("inquiry", `<div class="container page">${pageHead("STEP 05 · INQUIRY", "문의에 필요한 맥락을 한 번에 정리합니다", "자동발송이나 거래기능이 아니라, 빠짐없는 문의를 돕는 문안 복사 단계입니다.")}
  <div class="inquiry-grid"><aside><div class="card card-pad"><div class="section-title"><div><h2>선택 내용</h2><p>앞 단계의 맥락이 유지됩니다.</p></div></div><div class="summary-list"><div class="summary-item"><span>레시피</span><strong>고추장 제육볶음</strong></div><div class="summary-item"><span>검토 식재료</span><strong>고추장 → 된장 대체안</strong></div><div class="summary-item"><span>제조시설</span><strong>푸드파트너 제조센터</strong></div><div class="summary-item"><span>확인 필요</span><strong>혼합·가열 공정, MOQ, 원가, 납기</strong></div></div></div><div class="notice">이 화면은 문의 준비를 돕습니다. 계약·견적확정·결제·공동제조 거래는 현재 범위가 아닙니다.</div></aside>
  <section class="card inquiry-form"><div class="section-title"><div><h2>문의문안</h2><p>수정한 뒤 복사하여 전화 또는 업체 홈페이지 문의에 사용하세요.</p></div></div><div class="field"><label>문의 제목</label><input value="[공동제조 문의] 소스류 제품 제조 가능 여부"></div><div class="field"><label>문의 내용</label><textarea>안녕하세요. 소스류 제품의 공동제조 가능 여부를 문의드립니다.

검토 중인 제품: 고추장 제육볶음용 소스
검토 중인 대체안: 고추장 일부를 된장으로 대체
확인 요청사항:
1. 소스류 혼합·가열 공정 가능 여부
2. 최소 생산수량(MOQ)
3. 샘플·초도 생산 일정
4. 예상 견적과 준비자료

시설 HACCP 보유 정보는 확인했으며, 해당 제품·공정의 인증 범위는 별도 확인을 요청드립니다.</textarea></div><div class="action-row"><a class="button secondary" href="?screen=facility-detail">시설 상세로 돌아가기</a><button class="button primary" data-copy>문의문안 복사</button></div><p class="muted small" data-copy-feedback aria-live="polite"></p></section></div>
  </div>`);

const renderers = { home: renderHome, recipes: renderRecipes, "recipe-detail": renderRecipeDetail, ingredients: renderIngredients, "ingredient-detail": renderIngredientDetail, substitutes: renderSubstitutes, facilities: renderFacilities, "facility-detail": renderFacilityDetail, inquiry: renderInquiry };
const params = new URLSearchParams(location.search);
const screen = renderers[params.get("screen")] ? params.get("screen") : "home";
document.querySelector("#app").innerHTML = renderers[screen]();
document.documentElement.dataset.screen = screen;

const menuButton = document.querySelector(".mobile-menu");
const drawer = document.querySelector(".mobile-drawer");
menuButton.addEventListener("click", () => { const open = drawer.classList.toggle("open"); drawer.hidden = !open; menuButton.setAttribute("aria-expanded", String(open)); });
document.querySelector("[data-copy]")?.addEventListener("click", async () => { const text = document.querySelector("textarea")?.value || ""; try { await navigator.clipboard.writeText(text); document.querySelector("[data-copy-feedback]").textContent = "문의문안을 복사했습니다."; } catch { document.querySelector("[data-copy-feedback]").textContent = "브라우저에서 복사 권한을 확인해 주세요."; } });
