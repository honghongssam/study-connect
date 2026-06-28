/**
 * ==========================================================================
 * StudyConnect - 메인 애플리케이션 프론트엔드 비즈니스 로직 (app.js)
 * 설명: 파이어베이스 Firestore 데이터베이스 실시간 연동, 질문/답변 CRUD 및 상태 관리
 * ==========================================================================
 */

// --------------------------------------------------------------------------
// 1. 파이어베이스(Firebase) 설정 및 데이터베이스 초기화
// --------------------------------------------------------------------------

// ⚠️ 깃허브 및 파이어베이스 콘솔(Project Settings)에서 확인하신 설정값으로 아래를 채워주세요!
const firebaseConfig = {
  apiKey: "AIzaSyAMLWBxnWVZKBEXGLXntQMF3gkKy4rZ80o",
  authDomain: "study-connect-452d5.firebaseapp.com",
  projectId: "study-connect-452d5",
  storageBucket: "study-connect-452d5.firebasestorage.app",
  messagingSenderId: "965146016978",
  appId: "1:965146016978:web:f2db4390eb3d81b58a810b"
};

let db = null;
let useFirebase = false;

// 파이어베이스 연동 시도
try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    useFirebase = true;
    console.log("🔥 Firebase Firestore 데이터베이스 연결 완료!");
  } else {
    console.log("ℹ️ LocalStorage 모드로 동작 중입니다. firebaseConfig에 파이어베이스 키를 입력하면 클라우드 DB로 자동 전환됩니다.");
  }
} catch (e) {
  console.warn("Firebase 연동 준비 안내:", e);
}

// --------------------------------------------------------------------------
// 2. 상태 변수 및 현재 사용자 설정 (State & Current User)
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

// LocalStorage 키 명칭 (Fallback 용)
const STORAGE_KEY_QUESTIONS = "studyconnect_questions_v1";
const STORAGE_KEY_ANSWERS = "studyconnect_answers_v1";

// --------------------------------------------------------------------------
// 3. 초기 풍부한 샘플 데이터 (Initial Mock Data - 파이어베이스 최초 생성용)
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
    status: "resolved",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    likes: 8,
    acceptedAnswerId: "a_501"
  },
  {
    id: "q_102",
    userId: "user_01",
    authorName: "김학구",
    authorAvatar: "🎓",
    subject: "영어",
    tags: ["수능", "풀이과정"],
    title: "관계대명사 that과 관계부사 where 구별법 팁 있으신가요?",
    content: "빈칸 채우기 문제에서 뒤 문장이 완전한지 불완전한지 구별하는 게 제일 어렵습니다. 뒷문장의 형식(1~5형식)을 빠르게 확인하는 꿀팁이 궁금합니다.",
    status: "pending",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    likes: 4,
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
    content: "결론부터 말씀드리면 '미분가능하면 반드시 연속'이지만, '연속이라고 해서 반드시 미분가능한 것은 아니다'입니다!\n\n예를 들어 y=|x| 그래프는 x=0에서 연속이지만 뾰족한 점(첨점)입니다. 이 점에서 좌미분계수(-1)와 우미분계수(+1)가 다르기 때문에 순간변화율(미분계수)을 하나로 정의할 수 없어서 미분불가능합니다.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    likes: 12,
    isAccepted: true
  }
];

// --------------------------------------------------------------------------
// 4. 데이터 동기화 함수 (Firebase & LocalStorage Sync)
// --------------------------------------------------------------------------

/**
 * 데이터 불러오기 및 실시간 바인딩
 */
function loadData() {
  if (useFirebase && db) {
    // 🔥 파이어베이스 Firestore 실시간 수신기(onSnapshot) 연결
    db.collection("questions").onSnapshot((snapshot) => {
      if (snapshot.empty && state.questions.length === 0) {
        // DB가 완전 비어있으면 초기 시드 데이터 업로드
        initialQuestions.forEach(q => db.collection("questions").doc(q.id).set(q));
      } else {
        state.questions = snapshot.docs.map(doc => doc.data());
        renderApp();
        if (state.activeQuestionId) renderDetailModalContent();
      }
    });

    db.collection("answers").onSnapshot((snapshot) => {
      if (snapshot.empty && state.answers.length === 0) {
        initialAnswers.forEach(a => db.collection("answers").doc(a.id).set(a));
      } else {
        state.answers = snapshot.docs.map(doc => doc.data());
        renderApp();
        if (state.activeQuestionId) renderDetailModalContent();
      }
    });
  } else {
    // 💾 LocalStorage fallback 모드
    const savedQuestions = localStorage.getItem(STORAGE_KEY_QUESTIONS);
    const savedAnswers = localStorage.getItem(STORAGE_KEY_ANSWERS);

    if (savedQuestions && savedAnswers) {
      state.questions = JSON.parse(savedQuestions);
      state.answers = JSON.parse(savedAnswers);
    } else {
      state.questions = initialQuestions;
      state.answers = initialAnswers;
      saveData();
    }
    renderApp();
  }
}

/**
 * 로컬 스토리지 데이터 저장 (Fallback)
 */
function saveData() {
  if (!useFirebase) {
    localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(state.questions));
    localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(state.answers));
  }
}

// --------------------------------------------------------------------------
// 5. 유틸리티 함수 (Utility Functions)
// --------------------------------------------------------------------------

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
// 6. UI 렌더링 로직 (Rendering Functions)
// --------------------------------------------------------------------------

function renderApp() {
  renderQuestionFeed();
  renderUserProfile();
  renderQuickQuestions();
}

function renderQuestionFeed() {
  const feedContainer = document.getElementById("questionFeed");
  const countElement = document.getElementById("questionCount");
  const filterTitleElement = document.getElementById("currentFilterTitle");

  let filtered = state.questions.filter(q => {
    if (state.selectedSubject !== "all" && q.subject !== state.selectedSubject) return false;
    if (state.selectedTag !== "all" && !q.tags.includes(state.selectedTag)) return false;
    if (state.searchQuery.trim() !== "") {
      const query = state.searchQuery.toLowerCase();
      const matchTitle = q.title.toLowerCase().includes(query);
      const matchContent = q.content.toLowerCase().includes(query);
      if (!matchTitle && !matchContent) return false;
    }
    return true;
  });

  if (state.sortBy === "latest") {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (state.sortBy === "popular") {
    filtered.sort((a, b) => b.likes - a.likes);
  } else if (state.sortBy === "unanswered") {
    filtered = filtered.filter(q => q.status === "pending");
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  let subjectName = state.selectedSubject === "all" ? "전체 과목" : state.selectedSubject;
  let tagName = state.selectedTag === "all" ? "" : ` (#${state.selectedTag})`;
  filterTitleElement.textContent = `${subjectName}${tagName} 질문 목록`;
  countElement.textContent = `${filtered.length}개의 질문`;

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

  feedContainer.innerHTML = filtered.map(q => {
    const answerCount = state.answers.filter(a => a.questionId === q.id).length;
    const statusLabel = q.status === "resolved" ? "✅ 해결 완료" : "⏳ 답변 대기 중";
    const statusClass = q.status === "resolved" ? "resolved" : "pending";
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

function renderUserProfile() {
  const myQuestionsCount = state.questions.filter(q => q.userId === currentUser.userId).length;
  const myAnswers = state.answers.filter(a => a.userId === currentUser.userId);
  const myAnswersCount = myAnswers.length;
  const myAcceptedCount = myAnswers.filter(a => a.isAccepted).length;

  document.getElementById("userQuestionCount").textContent = myQuestionsCount;
  document.getElementById("userAnswerCount").textContent = myAnswersCount;
  document.getElementById("userAcceptedCount").textContent = myAcceptedCount;
}

function renderQuickQuestions() {
  const quickContainer = document.getElementById("quickQuestionsList");
  if (!quickContainer) return;

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
// 7. 모달 및 CRUD 이벤트 처리 (Firebase Firestore 연동)
// --------------------------------------------------------------------------

function openNewQuestionModal() {
  document.getElementById("newQuestionModal").classList.add("active");
}

function closeNewQuestionModal() {
  document.getElementById("newQuestionForm").reset();
  document.getElementById("newQuestionModal").classList.remove("active");
}

function handleNewQuestionSubmit(e) {
  e.preventDefault();

  const subject = document.getElementById("inputSubject").value;
  const title = document.getElementById("inputTitle").value.trim();
  const tagsRaw = document.getElementById("inputTags").value.trim();
  const content = document.getElementById("inputContent").value.trim();
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim().replace(/^#/, "")) : ["기타"];

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

  if (useFirebase && db) {
    // 🔥 Firestore에 새 질문 저장
    db.collection("questions").doc(newQuestion.id).set(newQuestion);
  } else {
    state.questions.unshift(newQuestion);
    saveData();
    renderApp();
  }

  closeNewQuestionModal();
}

function openDetailModal(questionId) {
  state.activeQuestionId = questionId;
  renderDetailModalContent();
  document.getElementById("detailModal").classList.add("active");
}

function closeDetailModal() {
  state.activeQuestionId = null;
  document.getElementById("detailModal").classList.remove("active");
}

function renderDetailModalContent() {
  const container = document.getElementById("detailModalContent");
  const question = state.questions.find(q => q.id === state.activeQuestionId);
  
  if (!question) return;

  document.getElementById("detailSubject").textContent = `${question.subject} 카테고리`;
  const questionAnswers = state.answers.filter(a => a.questionId === question.id);
  questionAnswers.sort((a, b) => (b.isAccepted ? 1 : 0) - (a.isAccepted ? 1 : 0));

  const tagsHtml = question.tags.map(t => `<span class="inline-tag">#${t}</span>`).join(" ");
  const isQuestionAuthor = question.userId === currentUser.userId;

  container.innerHTML = `
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

function likeQuestion(questionId) {
  const q = state.questions.find(item => item.id === questionId);
  if (q) {
    const newLikes = q.likes + 1;
    if (useFirebase && db) {
      db.collection("questions").doc(questionId).update({ likes: newLikes });
    } else {
      q.likes = newLikes;
      saveData();
      renderApp();
      renderDetailModalContent();
    }
  }
}

function likeAnswer(answerId) {
  const a = state.answers.find(item => item.id === answerId);
  if (a) {
    const newLikes = a.likes + 1;
    if (useFirebase && db) {
      db.collection("answers").doc(answerId).update({ likes: newLikes });
    } else {
      a.likes = newLikes;
      saveData();
      renderDetailModalContent();
    }
  }
}

function acceptAnswer(questionId, answerId) {
  if (useFirebase && db) {
    db.collection("questions").doc(questionId).update({ status: "resolved", acceptedAnswerId: answerId });
    db.collection("answers").doc(answerId).update({ isAccepted: true });
  } else {
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
}

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
    userId: currentUser.userId,
    authorName: currentUser.userName,
    authorAvatar: currentUser.userAvatar,
    content: content,
    createdAt: new Date().toISOString(),
    likes: 0,
    isAccepted: false
  };

  if (useFirebase && db) {
    db.collection("answers").doc(newAnswer.id).set(newAnswer);
  } else {
    state.answers.push(newAnswer);
    saveData();
    renderApp();
    renderDetailModalContent();
  }
}

// --------------------------------------------------------------------------
// 8. 이벤트 리스너 바인딩 및 애플리케이션 초기화 (Initialization)
// --------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  document.getElementById("categoryList").addEventListener("click", (e) => {
    const item = e.target.closest(".category-item");
    if (!item) return;
    document.querySelectorAll(".category-item").forEach(el => el.classList.remove("active"));
    item.classList.add("active");
    state.selectedSubject = item.dataset.subject;
    renderQuestionFeed();
  });

  document.getElementById("tagCloud").addEventListener("click", (e) => {
    const btn = e.target.closest(".tag-chip");
    if (!btn) return;
    document.querySelectorAll(".tag-chip").forEach(el => el.classList.remove("active"));
    btn.classList.add("active");
    state.selectedTag = btn.dataset.tag;
    renderQuestionFeed();
  });

  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderQuestionFeed();
  });

  document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sort-btn").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
      state.sortBy = btn.dataset.sort;
      renderQuestionFeed();
    });
  });

  document.getElementById("btnOpenNewQuestion").addEventListener("click", openNewQuestionModal);
  document.getElementById("btnCloseNewQuestion").addEventListener("click", closeNewQuestionModal);
  document.getElementById("btnCancelNewQuestion").addEventListener("click", closeNewQuestionModal);
  document.getElementById("newQuestionForm").addEventListener("submit", handleNewQuestionSubmit);
  document.getElementById("btnCloseDetail").addEventListener("click", closeDetailModal);

  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      closeNewQuestionModal();
      closeDetailModal();
    }
  });
});
