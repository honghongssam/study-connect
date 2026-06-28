/**
 * ==========================================================================
 * StudyConnect - 메인 애플리케이션 프론트엔드 비즈니스 로직 (app.js)
 * 설명: 파이어베이스 Firestore DB & Auth 인증 (구글/이메일 로그인/회원가입) 연동
 * ==========================================================================
 */

// --------------------------------------------------------------------------
// 1. 파이어베이스(Firebase) 설정 및 초기화
// --------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyAMLWBxnWVZKBEXGLXntQMF3gkKy4rZ80o",
  authDomain: "study-connect-452d5.firebaseapp.com",
  projectId: "study-connect-452d5",
  storageBucket: "study-connect-452d5.firebasestorage.app",
  messagingSenderId: "965146016978",
  appId: "1:965146016978:web:f2db4390eb3d81b58a810b"
};

let db = null;
let auth = null;
let useFirebase = false;

// 파이어베이스 연동 초기화
try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    useFirebase = true;
    console.log("🔥 Firebase Firestore 및 Authentication 초기화 완료!");
  }
} catch (e) {
  console.warn("Firebase 연동 준비 안내:", e);
}

// --------------------------------------------------------------------------
// 2. 상태 변수 및 사용자 설정 (State & Current User)
// --------------------------------------------------------------------------

let currentUser = {
  userId: "guest",
  userName: "로그인이 필요합니다",
  userAvatar: "👤",
  isLoggedIn: false
};

let state = {
  questions: [],        
  answers: [],          
  selectedSubject: "all",
  selectedTag: "all",     
  searchQuery: "",       
  sortBy: "latest",      
  activeQuestionId: null 
};

let isAuthModeSignup = false; // false: 로그인 모드, true: 회원가입 모드

const STORAGE_KEY_QUESTIONS = "studyconnect_questions_v1";
const STORAGE_KEY_ANSWERS = "studyconnect_answers_v1";

// 초기 샘플 데이터
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
  }
];

const initialAnswers = [
  {
    id: "a_501",
    questionId: "q_101",
    userId: "user_04",
    authorName: "정멘토",
    authorAvatar: "👨‍🏫",
    content: "결론부터 말씀드리면 '미분가능하면 반드시 연속'이지만, '연속이라고 해서 반드시 미분가능한 것은 아니다'입니다!",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    likes: 12,
    isAccepted: true
  }
];

// --------------------------------------------------------------------------
// 3. 파이어베이스 인증 상태 수신기 (Auth State Listener)
// --------------------------------------------------------------------------

function initAuthListener() {
  if (useFirebase && auth) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        // 로그인 성공 시 사용자 정보 반영
        currentUser = {
          userId: user.uid,
          userName: user.displayName || user.email.split("@")[0],
          userAvatar: user.photoURL ? `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : "🎓",
          isLoggedIn: true,
          email: user.email
        };
        console.log("👤 로그인 성공:", currentUser.userName);
      } else {
        // 로그아웃 또는 게스트 상태
        currentUser = {
          userId: "guest",
          userName: "로그인이 필요합니다",
          userAvatar: "👤",
          isLoggedIn: false
        };
        console.log("👤 게스트 상태");
      }
      updateAuthUI();
      renderApp();
    });
  } else {
    // LocalStorage 모드 시 기본 테스트 유저로 설정
    currentUser = {
      userId: "user_01",
      userName: "김학구 (테스트)",
      userAvatar: "🎓",
      isLoggedIn: true
    };
    updateAuthUI();
  }
}

/**
 * 로그인/로그아웃 버튼 및 프로필 UI 업데이트
 */
function updateAuthUI() {
  const nameEl = document.getElementById("userName");
  const tagEl = document.getElementById("userIdTag");
  const avatarEl = document.getElementById("userAvatar");
  const btnOpenAuth = document.getElementById("btnOpenAuth");
  const btnLogout = document.getElementById("btnLogout");
  const noticeEl = document.getElementById("newQuestionAuthorNotice");

  if (nameEl) nameEl.textContent = currentUser.userName;
  if (tagEl) tagEl.textContent = currentUser.isLoggedIn ? `@${currentUser.userName}` : "Guest User";
  if (avatarEl) avatarEl.innerHTML = currentUser.userAvatar;

  if (currentUser.isLoggedIn) {
    if (btnOpenAuth) btnOpenAuth.style.display = "none";
    if (btnLogout) btnLogout.style.display = "block";
    if (noticeEl) noticeEl.innerHTML = `ℹ️ 질문은 현재 로그인된 <strong>${currentUser.userName}</strong> 계정 명의로 저장됩니다.`;
  } else {
    if (btnOpenAuth) btnOpenAuth.style.display = "block";
    if (btnLogout) btnLogout.style.display = "none";
    if (noticeEl) noticeEl.innerHTML = `⚠️ 질문을 남기려면 <strong>로그인</strong>이 필요합니다.`;
  }
}

// --------------------------------------------------------------------------
// 4. 데이터 동기화 함수 (Firebase & LocalStorage Sync)
// --------------------------------------------------------------------------

function loadData() {
  if (useFirebase && db) {
    db.collection("questions").onSnapshot((snapshot) => {
      if (snapshot.empty && state.questions.length === 0) {
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

function saveData() {
  if (!useFirebase) {
    localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(state.questions));
    localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(state.answers));
  }
}

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
// 5. UI 렌더링 로직 (Rendering Functions)
// --------------------------------------------------------------------------

function renderApp() {
  renderQuestionFeed();
  renderUserProfile();
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
  if (!currentUser.isLoggedIn) {
    document.getElementById("userQuestionCount").textContent = 0;
    document.getElementById("userAnswerCount").textContent = 0;
    document.getElementById("userAcceptedCount").textContent = 0;
    return;
  }
  const myQuestionsCount = state.questions.filter(q => q.userId === currentUser.userId).length;
  const myAnswers = state.answers.filter(a => a.userId === currentUser.userId);
  const myAnswersCount = myAnswers.length;
  const myAcceptedCount = myAnswers.filter(a => a.isAccepted).length;

  document.getElementById("userQuestionCount").textContent = myQuestionsCount;
  document.getElementById("userAnswerCount").textContent = myAnswersCount;
  document.getElementById("userAcceptedCount").textContent = myAcceptedCount;
}

// --------------------------------------------------------------------------
// 6. 인증 핸들러 (Google & Email Auth Handlers)
// --------------------------------------------------------------------------

function openAuthModal() {
  document.getElementById("authModal").classList.add("active");
}

function closeAuthModal() {
  document.getElementById("authModal").classList.remove("active");
  document.getElementById("emailAuthForm").reset();
}

function toggleAuthMode() {
  isAuthModeSignup = !isAuthModeSignup;
  const titleEl = document.getElementById("authModalTitle");
  const submitBtnEl = document.getElementById("btnSubmitAuth");
  const toggleTextEl = document.getElementById("authToggleText");
  const toggleBtnEl = document.getElementById("btnToggleAuthMode");
  const groupDisplayName = document.getElementById("groupDisplayName");

  if (isAuthModeSignup) {
    titleEl.textContent = "📝 스터디커넥트 회원가입";
    submitBtnEl.textContent = "회원가입 완료";
    toggleTextEl.textContent = "이미 계정이 있으신가요?";
    toggleBtnEl.textContent = "로그인하기";
    groupDisplayName.style.display = "flex";
  } else {
    titleEl.textContent = "🔐 스터디커넥트 로그인";
    submitBtnEl.textContent = "로그인하기";
    toggleTextEl.textContent = "아직 계정이 없으신가요?";
    toggleBtnEl.textContent = "회원가입하기";
    groupDisplayName.style.display = "none";
  }
}

/**
 * 구글 계정 소셜 로그인
 */
function handleGoogleLogin() {
  if (!useFirebase || !auth) {
    alert("파이어베이스가 연결되지 않은 상태입니다.");
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then((result) => {
      alert(`환영합니다, ${result.user.displayName || '학생'}님! 🎉`);
      closeAuthModal();
    })
    .catch((error) => {
      console.error("구글 로그인 실패:", error);
      alert(`구글 로그인 실패: ${error.message}`);
    });
}

/**
 * 이메일/비밀번호 로그인 및 회원가입 제출
 */
function handleEmailAuthSubmit(e) {
  e.preventDefault();
  if (!useFirebase || !auth) {
    alert("파이어베이스가 연결되지 않은 상태입니다.");
    return;
  }

  const email = document.getElementById("inputEmail").value.trim();
  const password = document.getElementById("inputPassword").value;
  const displayName = document.getElementById("inputDisplayName").value.trim();

  if (isAuthModeSignup) {
    // 1) 이메일 회원가입
    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        return user.updateProfile({
          displayName: displayName || email.split("@")[0]
        });
      })
      .then(() => {
        alert("회원가입이 성공적으로 완료되었습니다! 🎉");
        closeAuthModal();
      })
      .catch((error) => {
        console.error("회원가입 실패:", error);
        alert(`회원가입 에러: ${error.message}`);
      });
  } else {
    // 2) 이메일 로그인
    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        alert(`로그인 성공! 환영합니다.`);
        closeAuthModal();
      })
      .catch((error) => {
        console.error("로그인 실패:", error);
        alert(`로그인 실패: 이메일이나 비밀번호를 확인해주세요.`);
      });
  }
}

/**
 * 로그아웃 처리
 */
function handleLogout() {
  if (useFirebase && auth) {
    auth.signOut().then(() => {
      alert("로그아웃되었습니다.");
    });
  }
}

// --------------------------------------------------------------------------
// 7. 모달 및 Q&A CRUD 이벤트 처리
// --------------------------------------------------------------------------

function openNewQuestionModal() {
  if (useFirebase && !currentUser.isLoggedIn) {
    alert("질문을 작성하려면 먼저 로그인해주세요!");
    openAuthModal();
    return;
  }
  document.getElementById("newQuestionModal").classList.add("active");
}

function closeNewQuestionModal() {
  document.getElementById("newQuestionForm").reset();
  document.getElementById("newQuestionModal").classList.remove("active");
}

function handleNewQuestionSubmit(e) {
  e.preventDefault();

  if (useFirebase && !currentUser.isLoggedIn) {
    alert("로그인이 필요한 기능입니다.");
    openAuthModal();
    return;
  }

  const subject = document.getElementById("inputSubject").value;
  const title = document.getElementById("inputTitle").value.trim();
  const tagsRaw = document.getElementById("inputTags").value.trim();
  const content = document.getElementById("inputContent").value.trim();
  const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim().replace(/^#/, "")) : ["기타"];

  const newQuestion = {
    id: "q_" + Date.now(),
    userId: currentUser.userId,
    authorName: currentUser.userName,
    authorAvatar: currentUser.userAvatar.includes("<img") ? "🎓" : currentUser.userAvatar,
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
          <span class="author-name">${question.authorName}</span>
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
        <span style="font-size: 12px; color: var(--text-muted);">작성자: <strong>${currentUser.isLoggedIn ? currentUser.userName : '게스트 (로그인 필요)'}</strong></span>
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
  if (useFirebase && !currentUser.isLoggedIn) {
    alert("답변을 남기려면 먼저 로그인해주세요!");
    openAuthModal();
    return;
  }

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
    authorAvatar: currentUser.userAvatar.includes("<img") ? "🎓" : currentUser.userAvatar,
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
// 8. 초기화 및 이벤트 바인딩 (Initialization)
// --------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initAuthListener();
  loadData();

  // 필터 이벤트
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

  // 인증 관련 이벤트 바인딩
  document.getElementById("btnOpenAuth").addEventListener("click", openAuthModal);
  document.getElementById("btnCloseAuth").addEventListener("click", closeAuthModal);
  document.getElementById("btnToggleAuthMode").addEventListener("click", toggleAuthMode);
  document.getElementById("btnGoogleAuth").addEventListener("click", handleGoogleLogin);
  document.getElementById("emailAuthForm").addEventListener("submit", handleEmailAuthSubmit);
  document.getElementById("btnLogout").addEventListener("click", handleLogout);

  // Q&A 모달 이벤트
  document.getElementById("btnOpenNewQuestion").addEventListener("click", openNewQuestionModal);
  document.getElementById("btnCloseNewQuestion").addEventListener("click", closeNewQuestionModal);
  document.getElementById("btnCancelNewQuestion").addEventListener("click", closeNewQuestionModal);
  document.getElementById("newQuestionForm").addEventListener("submit", handleNewQuestionSubmit);
  document.getElementById("btnCloseDetail").addEventListener("click", closeDetailModal);

  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      closeAuthModal();
      closeNewQuestionModal();
      closeDetailModal();
    }
  });
});
