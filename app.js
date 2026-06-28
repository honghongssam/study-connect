/**
 * ==========================================================================
 * StudyConnect - 메인 애플리케이션 프론트엔드 비즈니스 로직 (app.js)
 * 설명: 질문 게시판 CRUD, 데이터 필터링, 모달 상태 제어 및 LocalStorage 관리
 * ==========================================================================
 */

// --------------------------------------------------------------------------
// 1. 상태 변수 및 현재 사용자 설정 (State & Current User)
// --------------------------------------------------------------------------

// 요구사항: 테스트 유저 'user_01' 계정 명의로 모든 데이터 동작
const currentUser = {
  userId: "user_01",
  userName: "김학구",
  userAvatar: "🎓",
  grade: "2학년 3반"
};

// 애플리케이션 활성 상태 (필터링 및 정렬 기준 저장)
let state = {
  questions: [],        // 질문 전체 배열 목록
  answers: [],          // 답변(댓글) 전체 배열 목록
  selectedSubject: "all", // 선택된 과목 필터 ('all' 또는 '수학', '영어' 등)
  selectedTag: "all",     // 선택된 태그 필터 ('all' 또는 '#개념이해' 등)
  searchQuery: "",       // 검색어 문자열
  sortBy: "latest",      // 정렬 방식 ('latest': 최신순, 'popular': 추천순, 'unanswered': 답변 대기순)
  activeQuestionId: null // 현재 상세 모달에 열려있는 질문 ID
};

// LocalStorage 키 명칭
const STORAGE_KEY_QUESTIONS = "studyconnect_questions_v1";
const STORAGE_KEY_ANSWERS = "studyconnect_answers_v1";

// --------------------------------------------------------------------------
// 2. 초기 풍부한 샘플 데이터 (Initial Mock Data)
// --------------------------------------------------------------------------
const initialQuestions = [
  {
    id: "q_101",
    userId: "user_02",
    authorName: "이수학",
    authorAvatar: "📐",
    subject: "수학",
    tags: ["개념이해", "수학II"],
    title: "미분가능성과 연속성의 관계가 헷갈려요!",
    content: "함수가 어떤 점에서 연속이면 항상 미분가능한가요? 아니면 미분가능해야 연속인가요? 꺾인 점(첨점)에서의 미분계수가 왜 존재하지 않는지 쉽게 설명 부탁드립니다!",
    status: "resolved", // 'pending': 답변대기, 'resolved': 해결완료
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3시간 전
    likes: 8,
    acceptedAnswerId: "a_501"
  },
  {
    id: "q_102",
    userId: "user_01", // 테스트 유저가 작성한 질문 예시
    authorName: "김학구",
    authorAvatar: "🎓",
    subject: "영어",
    tags: ["수능", "풀이과정"],
    title: "관계대명사 that과 관계부사 where 구별법 팁 있으신가요?",
    content: "빈칸 채우기 문제에서 뒤 문장이 완전한지 불완전한지 구별하는 게 제일 어렵습니다. 뒷문장의 형식(1~5형식)을 빠르게 확인하는 꿀팁이 궁금합니다.",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12시간 전
    likes: 4,
    acceptedAnswerId: null
  },
  {
    id: "q_103",
    userId: "user_03",
    authorName: "박과학",
    authorAvatar: "🧪",
    subject: "과학",
    tags: ["기출문제", "중간고사"],
    title: "물리학I 뉴턴의 운동 제3법칙(작용 반작용)과 힘의 평형 차이",
    content: "두 힘의 크기가 같고 방향이 반대인 것은 똑같은데, 작용 반작용 관계의 두 힘과 힘의 평형 관계인 두 힘을 어떻게 명확히 구분할 수 있나요?",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1일 전
    likes: 15,
    acceptedAnswerId: null
  }
];

const initialAnswers = [
  {
    id: "a_501",
    questionId: "q_101",
    userId: "user_04",
    authorName: "정멘토",
    authorAvatar: "👨‍🏫",
    content: "결론부터 말씀드리면 '미분가능하면 반드시 연속'이지만, '연속이라고 해서 반드시 미분가능한 것은 아니다'입니다!\n\n예를 들어 y=|x| 그래프는 x=0에서 연속이지만 뾰족한 점(첨점)입니다. 이 점에서 좌미분계수(-1)와 우미분계수(+1)가 다르기 때문에 순간변화율(미분계수)을 하나로 정의할 수 없어서 미분불가능합니다. 쉽게 생각해서 뾰족한 곳에서는 접선을 하나로 그릴 수 없다고 이해하시면 돼요!",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    likes: 12,
    isAccepted: true
  },
  {
    id: "a_502",
    questionId: "q_102",
    userId: "user_05",
    authorName: "최영영",
    authorAvatar: "🔤",
    content: "뒤에 주어나 목적어가 빠져서 비어있으면 관계대명사(that/which/who) 자리이고, 장소/시간/이유 등의 전치사+명사 덩어리가 통째로 넘어간 거라면 관계부사(where/when/why) 자리입니다! 동사가 타동사인지 자동사인지 먼저 확인해보세요.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    likes: 3,
    isAccepted: false
  }
];

// --------------------------------------------------------------------------
// 3. 로컬 스토리지 데이터 동기화 함수 (LocalStorage Sync Functions)
// --------------------------------------------------------------------------

/**
 * 초기화 및 저장소 불러오기
 */
function loadData() {
  const savedQuestions = localStorage.getItem(STORAGE_KEY_QUESTIONS);
  const savedAnswers = localStorage.getItem(STORAGE_KEY_ANSWERS);

  if (savedQuestions && savedAnswers) {
    state.questions = JSON.parse(savedQuestions);
    state.answers = JSON.parse(savedAnswers);
  } else {
    // 저장된 데이터가 없으면 샘플 데이터로 저장소 초기화
    state.questions = initialQuestions;
    state.answers = initialAnswers;
    saveData();
  }
}

/**
 * 변경된 상태를 로컬 스토리지에 저장
 */
function saveData() {
  localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(state.questions));
  localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(state.answers));
}

// --------------------------------------------------------------------------
// 4. 유틸리티 및 시간 계산 함수 (Utility Helper Functions)
// --------------------------------------------------------------------------

/**
 * 작성 시간을 "몇 분 전", "몇 시간 전" 형태로 변환하는 유틸리티
 */
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "방금 전";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
  return `${Math.floor(diffInSeconds / 86400)}일 전`;
}

// --------------------------------------------------------------------------
// 5. 화면 UI 렌더링 로직 (UI Rendering Functions)
// --------------------------------------------------------------------------

/**
 * 앱 전체 화면 및 게시판 렌더링 실행
 */
function renderApp() {
  renderQuestionFeed();
  renderUserProfile();
  renderQuickQuestions();
}

/**
 * 중앙 메인 게시판 ( 질문 피드 목록 ) 렌더링
 */
function renderQuestionFeed() {
  const feedContainer = document.getElementById("questionFeed");
  const countElement = document.getElementById("questionCount");
  const filterTitleElement = document.getElementById("currentFilterTitle");

  // 1) 필터링 로직 수행 (과목, 태그, 검색어)
  let filtered = state.questions.filter(q => {
    // 과목 필터
    if (state.selectedSubject !== "all" && q.subject !== state.selectedSubject) return false;
    // 태그 필터
    if (state.selectedTag !== "all" && !q.tags.includes(state.selectedTag)) return false;
    // 검색어 필터 (제목 또는 본문 포함 여부)
    if (state.searchQuery.trim() !== "") {
      const query = state.searchQuery.toLowerCase();
      const matchTitle = q.title.toLowerCase().includes(query);
      const matchContent = q.content.toLowerCase().includes(query);
      if (!matchTitle && !matchContent) return false;
    }
    return true;
  });

  // 2) 정렬 로직 수행
  if (state.sortBy === "latest") {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (state.sortBy === "popular") {
    filtered.sort((a, b) => b.likes - a.likes);
  } else if (state.sortBy === "unanswered") {
    filtered = filtered.filter(q => q.status === "pending");
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // 필터 제목 및 개수 업데이트
  let subjectName = state.selectedSubject === "all" ? "전체 과목" : state.selectedSubject;
  let tagName = state.selectedTag === "all" ? "" : ` (#${state.selectedTag})`;
  filterTitleElement.textContent = `${subjectName}${tagName} 질문 목록`;
  countElement.textContent = `${filtered.length}개의 질문`;

  // 질문 카드가 없을 때의 처리
  if (filtered.length === 0) {
    feedContainer.innerHTML = `
      <div class="empty-feed">
        <div class="icon">🔍</div>
        <p>조건에 맞는 질문이 아직 없어요.</p>
        <p style="font-size: 12px; margin-top: 4px;">첫 번째 질문의 주인공이 되어보세요!</p>
      </div>
    `;
    return;
  }

  // 3) HTML 카드 dynamic 생성
  feedContainer.innerHTML = filtered.map(q => {
    // 해당 질문에 달린 답변 수 계산
    const answerCount = state.answers.filter(a => a.questionId === q.id).length;
    
    // 상태 뱃지 라벨 및 스타일 class 설정
    const statusLabel = q.status === "resolved" ? "✅ 해결 완료" : "⏳ 답변 대기 중";
    const statusClass = q.status === "resolved" ? "resolved" : "pending";

    // 태그 HTML 칩 태그 생성
    const tagsHtml = q.tags.map(t => `<span class="inline-tag">#${t}</span>`).join(" ");

    return `
      <article class="question-card" onclick="openDetailModal('${q.id}')">
        <div class="card-top">
          <div class="card-meta-left">
            <span class="badge-subject">${q.subject}</span>
            <span class="badge-status ${statusClass}">${statusLabel}</span>
          </div>
          <span class="card-time">${formatTimeAgo(q.createdAt)}</span>
        </div>
        <h3 class="card-title">${q.title}</h3>
        <p class="card-snippet">${q.content}</p>
        <div class="card-tags">
          ${tagsHtml}
        </div>
        <div class="card-bottom">
          <div class="author-info">
            <div class="author-avatar">${q.authorAvatar}</div>
            <span class="author-name">${q.authorName}</span>
          </div>
          <div class="card-stats">
            <span class="stat-icon-group">💬 답변 ${answerCount}</span>
            <span class="stat-icon-group">👍 도움돼요 ${q.likes}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/**
 * 우측 사이드바: 테스트 유저 (user_01) 프로필 요약 카드 렌더링
 */
function renderUserProfile() {
  const myQuestionsCount = state.questions.filter(q => q.userId === currentUser.userId).length;
  const myAnswers = state.answers.filter(a => a.userId === currentUser.userId);
  const myAnswersCount = myAnswers.length;
  const myAcceptedCount = myAnswers.filter(a => a.isAccepted).length;

  document.getElementById("userQuestionCount").textContent = myQuestionsCount;
  document.getElementById("userAnswerCount").textContent = myAnswersCount;
  document.getElementById("userAcceptedCount").textContent = myAcceptedCount;
}

/**
 * 우측 사이드바: 답변 대기 중인 질문 퀵 리스트 렌더링
 */
function renderQuickQuestions() {
  const quickContainer = document.getElementById("quickQuestionsList");
  if (!quickContainer) return; // 2단 구조 전환으로 해당 요소가 없을 경우 리턴
  
  // 답변 수 0개이고 pending 상태인 질문 3개 추출
  const pendingQuestions = state.questions.filter(q => {
    const ansCount = state.answers.filter(a => a.questionId === q.id).length;
    return q.status === "pending" && ansCount === 0;
  }).slice(0, 3);

  if (pendingQuestions.length === 0) {
    quickContainer.innerHTML = `<p style="font-size:12px; color: var(--text-muted);">모든 질문에 답변이 작성되었습니다! 🎉</p>`;
    return;
  }

  quickContainer.innerHTML = pendingQuestions.map(q => `
    <div class="quick-item" onclick="openDetailModal('${q.id}')">
      <div class="quick-title">${q.title}</div>
      <div class="quick-meta">${q.subject} • ${formatTimeAgo(q.createdAt)}</div>
    </div>
  `).join("");
}

// --------------------------------------------------------------------------
// 6. 질문 작성 및 상세 모달 제어 (Modal Handling)
// --------------------------------------------------------------------------

/**
 * 새 질문 작성 모달 열기
 */
function openNewQuestionModal() {
  document.getElementById("newQuestionModal").classList.add("active");
}

/**
 * 새 질문 작성 모달 닫기
 */
function closeNewQuestionModal() {
  document.getElementById("newQuestionForm").reset();
  document.getElementById("newQuestionModal").classList.remove("active");
}

/**
 * 새 질문 폼 제출 (Create Question)
 */
function handleNewQuestionSubmit(e) {
  e.preventDefault();

  const subject = document.getElementById("inputSubject").value;
  const title = document.getElementById("inputTitle").value.trim();
  const tagsRaw = document.getElementById("inputTags").value.trim();
  const content = document.getElementById("inputContent").value.trim();

  // 태그 파싱 (쉼표 구분)
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim().replace(/^#/, "")) : ["기타"];

  // 신규 질문 객체 작성 (요구사항: 작성자 ID는 user_01로 등록)
  const newQuestion = {
    id: "q_" + Date.now(),
    userId: currentUser.userId,
    authorName: currentUser.userName,
    authorAvatar: currentUser.userAvatar,
    subject: subject,
    tags: tags,
    title: title,
    content: content,
    status: "pending",
    createdAt: new Date().toISOString(),
    likes: 0,
    acceptedAnswerId: null
  };

  state.questions.unshift(newQuestion); // 최신 목록 맨 앞에 추가
  saveData();
  renderApp();
  closeNewQuestionModal();
}

/**
 * 질문 상세 보기 & 답변 작성 모달 열기 (Read & Comment)
 */
function openDetailModal(questionId) {
  state.activeQuestionId = questionId;
  renderDetailModalContent();
  document.getElementById("detailModal").classList.add("active");
}

/**
 * 질문 상세 보기 모달 닫기
 */
function closeDetailModal() {
  state.activeQuestionId = null;
  document.getElementById("detailModal").classList.remove("active");
}

/**
 * 상세 보기 모달 내부 동적 HTML 렌더링
 */
function renderDetailModalContent() {
  const container = document.getElementById("detailModalContent");
  const question = state.questions.find(q => q.id === state.activeQuestionId);
  
  if (!question) return;

  // 상단 과목 뱃지 세팅
  document.getElementById("detailSubject").textContent = `${question.subject} 카테고리`;

  // 질문에 속한 답변 목록 추출
  const questionAnswers = state.answers.filter(a => a.questionId === question.id);
  questionAnswers.sort((a, b) => (b.isAccepted ? 1 : 0) - (a.isAccepted ? 1 : 0)); // 채택된 답변 우선 정렬

  const tagsHtml = question.tags.map(t => `<span class="inline-tag">#${t}</span>`).join(" ");
  const isQuestionAuthor = question.userId === currentUser.userId;

  container.innerHTML = `
    <!-- 1. 질문 본문 구역 -->
    <div class="detail-question-box">
      <div class="card-top" style="margin-bottom: 8px;">
        <span class="badge-status ${question.status === 'resolved' ? 'resolved' : 'pending'}">
          ${question.status === 'resolved' ? '✅ 해결 완료' : '⏳ 답변 대기 중'}
        </span>
        <span class="card-time">${formatTimeAgo(question.createdAt)}</span>
      </div>
      <h2 class="detail-title">${question.title}</h2>
      <div class="card-tags" style="margin-bottom: 16px;">${tagsHtml}</div>
      <p class="detail-body">${question.content}</p>
      <div class="card-bottom" style="margin-top: 16px;">
        <div class="author-info">
          <div class="author-avatar">${question.authorAvatar}</div>
          <span class="author-name">${question.authorName} (${question.userId})</span>
        </div>
        <button class="btn-like" onclick="likeQuestion('${question.id}')">
          👍 도움돼요 (${question.likes})
        </button>
      </div>
    </div>

    <!-- 2. 답변(댓글) 목록 구역 -->
    <div class="answers-section">
      <h3 class="answers-section-header">
        💬 답변 목록 (${questionAnswers.length})
      </h3>
      <div class="answer-list" style="margin-top: 14px;">
        ${questionAnswers.length === 0 ? `
          <p style="font-size: 14px; color: var(--text-muted); text-align: center; padding: 20px 0;">
            아직 작성된 답변이 없습니다. 첫 답변의 주인공이 되어보세요! 🚀
          </p>
        ` : questionAnswers.map(a => `
          <div class="answer-card ${a.isAccepted ? 'is-accepted' : ''}">
            ${a.isAccepted ? '<span class="accepted-badge">🏆 질문자 채택 답변</span>' : ''}
            <div class="author-info">
              <div class="author-avatar">${a.authorAvatar}</div>
              <div>
                <span class="author-name">${a.authorName}</span>
                <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${formatTimeAgo(a.createdAt)}</span>
              </div>
            </div>
            <p class="answer-body">${a.content}</p>
            <div class="answer-actions">
              <button class="btn-like" onclick="likeAnswer('${a.id}')">
                👍 도움돼요 (${a.likes})
              </button>
              ${isQuestionAuthor && !question.acceptedAnswerId ? `
                <button class="btn-accept" onclick="acceptAnswer('${question.id}', '${a.id}')">
                  ✔ 채택하기
                </button>
              ` : ''}
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- 3. 답변 작성 폼 구역 -->
    <div class="write-answer-box">
      <h4 style="font-size: 14px; font-weight: 600;">✏️ 나만의 답변 남기기</h4>
      <textarea id="answerContentInput" rows="3" placeholder="친절하고 상세한 풀이 과정을 남겨주세요..."></textarea>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; color: var(--text-muted);">작성자: <strong>@user_01 (${currentUser.userName})</strong></span>
        <button class="btn-primary" onclick="submitAnswer('${question.id}')" style="padding: 6px 16px; font-size: 13px;">
          답변 등록
        </button>
      </div>
    </div>
  `;
}

// --------------------------------------------------------------------------
// 7. 인터랙션 이벤트 핸들러 (Interaction Event Handlers)
// --------------------------------------------------------------------------

/**
 * 질문 도움돼요(좋아요) 누르기
 */
function likeQuestion(questionId) {
  const q = state.questions.find(item => item.id === questionId);
  if (q) {
    q.likes += 1;
    saveData();
    renderApp();
    renderDetailModalContent();
  }
}

/**
 * 답변 도움돼요(좋아요) 누르기
 */
function likeAnswer(answerId) {
  const a = state.answers.find(item => item.id === answerId);
  if (a) {
    a.likes += 1;
    saveData();
    renderDetailModalContent();
  }
}

/**
 * 질문 작성자가 답변 채택하기
 */
function acceptAnswer(questionId, answerId) {
  const q = state.questions.find(item => item.id === questionId);
  const a = state.answers.find(item => item.id === answerId);

  if (q && a) {
    q.status = "resolved";
    q.acceptedAnswerId = answerId;
    a.isAccepted = true;
    saveData();
    renderApp();
    renderDetailModalContent();
  }
}

/**
 * 답변 작성 제출 (Create Answer)
 */
function submitAnswer(questionId) {
  const input = document.getElementById("answerContentInput");
  const content = input.value.trim();

  if (!content) {
    alert("답변 내용을 입력해주세요!");
    return;
  }

  const newAnswer = {
    id: "a_" + Date.now(),
    questionId: questionId,
    userId: currentUser.userId, // 테스트 유저 user_01 명의로 저장
    authorName: currentUser.userName,
    authorAvatar: currentUser.userAvatar,
    content: content,
    createdAt: new Date().toISOString(),
    likes: 0,
    isAccepted: false
  };

  state.answers.push(newAnswer);
  saveData();
  renderApp();
  renderDetailModalContent();
}

// --------------------------------------------------------------------------
// 8. 이벤트 리스너 바인딩 및 애플리케이션 초기화 (Initialization)
// --------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // 1) 데이터 로드
  loadData();

  // 2) 초기 화면 렌더링
  renderApp();

  // 3) 과목 카테고리 필터 이벤트 바인딩
  document.getElementById("categoryList").addEventListener("click", (e) => {
    const item = e.target.closest(".category-item");
    if (!item) return;

    document.querySelectorAll(".category-item").forEach(el => el.classList.remove("active"));
    item.classList.add("active");

    state.selectedSubject = item.dataset.subject;
    renderQuestionFeed();
  });

  // 4) 태그 클라우드 필터 이벤트 바인딩
  document.getElementById("tagCloud").addEventListener("click", (e) => {
    const btn = e.target.closest(".tag-chip");
    if (!btn) return;

    document.querySelectorAll(".tag-chip").forEach(el => el.classList.remove("active"));
    btn.classList.add("active");

    state.selectedTag = btn.dataset.tag;
    renderQuestionFeed();
  });

  // 5) 검색어 입력 이벤트 바인딩
  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderQuestionFeed();
  });

  // 6) 정렬 버튼 이벤트 바인딩
  document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sort-btn").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");

      state.sortBy = btn.dataset.sort;
      renderQuestionFeed();
    });
  });

  // 7) 모달 열기 및 닫기 이벤트 바인딩
  document.getElementById("btnOpenNewQuestion").addEventListener("click", openNewQuestionModal);
  document.getElementById("btnCloseNewQuestion").addEventListener("click", closeNewQuestionModal);
  document.getElementById("btnCancelNewQuestion").addEventListener("click", closeNewQuestionModal);
  document.getElementById("newQuestionForm").addEventListener("submit", handleNewQuestionSubmit);
  document.getElementById("btnCloseDetail").addEventListener("click", closeDetailModal);

  // 모달 배경 바깥 클릭 시 닫기
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      closeNewQuestionModal();
      closeDetailModal();
    }
  });
});
