// Application State
let currentUser = null;
let isLoginMode = true;
let currentPage = 'tests-list';
let currentTest = null;
let currentQuestionIndex = 0;
let testAnswers = {};

// DOM Elements
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const app = document.getElementById('app');
const authToggle = document.getElementById('auth-toggle');
const nameField = document.getElementById('name-field');
const authSubtitle = document.getElementById('auth-subtitle');
const authBtn = document.getElementById('auth-btn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupNavigation();
});

// Auth Functions
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        showApp();
    }
}

async function loadUserProfile() {
    try {
        const profile = await db.getUserProfile(currentUser.id);
        if (!profile) {
            console.log('Creating new user profile...');
            try {
                await db.createUserProfile(currentUser.id, currentUser.email, currentUser.email.split('@')[0]);
                console.log('Profile created successfully');
            } catch (createError) {
                console.error('Error creating profile:', createError);
            }
        } else {
            updateUserUI(profile);
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

function updateUserUI(profile) {
    const userName = document.getElementById('user-name');
    const userRole = document.getElementById('user-role');
    const userAvatar = document.getElementById('user-avatar');
    
    if (profile.full_name) {
        userName.textContent = profile.full_name;
        userAvatar.textContent = profile.full_name.charAt(0).toUpperCase();
    } else {
        userName.textContent = currentUser.email;
        userAvatar.textContent = currentUser.email.charAt(0).toUpperCase();
    }
    
    const roles = {
        'employee': 'Сотрудник',
        'instructor': 'Инструктор',
        'admin': 'Администратор'
    };
    userRole.textContent = roles[profile.role] || 'Сотрудник';
}

async function handleAuth(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const fullName = document.getElementById('full-name').value;
    
    authBtn.disabled = true;
    authBtn.textContent = isLoginMode ? 'Вход...' : 'Регистрация...';
    
    try {
        if (isLoginMode) {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            currentUser = data.user;
            await loadUserProfile();
            showApp();
        } else {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });
            if (error) throw error;
            
            if (data.session) {
                currentUser = data.user;
                await loadUserProfile();
                showApp();
            } else {
                alert('Проверьте вашу почту для подтверждения регистрации. После подтверждения войдите в систему.');
            }
        }
    } catch (error) {
        console.error('Auth error:', error);
        alert('Ошибка: ' + error.message);
    } finally {
        authBtn.disabled = false;
        authBtn.textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
    }
}

function toggleAuthMode(e) {
    if (e) e.preventDefault();
    isLoginMode = !isLoginMode;
    
    if (isLoginMode) {
        authSubtitle.textContent = 'Вход в систему тестирования';
        authBtn.textContent = 'Войти';
        authToggle.innerHTML = 'Нет аккаунта? <a href="#" onclick="toggleAuthMode(event)">Зарегистрироваться</a>';
        nameField.classList.add('hidden');
    } else {
        authSubtitle.textContent = 'Регистрация';
        authBtn.textContent = 'Зарегистрироваться';
        authToggle.innerHTML = 'Есть аккаунт? <a href="#" onclick="toggleAuthMode(event)">Войти</a>';
        nameField.classList.remove('hidden');
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    authModal.classList.remove('hidden');
    app.classList.add('hidden');
}

function showApp() {
    authModal.classList.add('hidden');
    app.classList.remove('hidden');
    loadTestsList();
}

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    authForm.addEventListener('submit', handleAuth);
}

function navigateTo(page) {
    currentPage = page;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    const pageElement = document.getElementById(`page-${page}`);
    if (pageElement) {
        pageElement.classList.add('active');
    }
    
    switch (page) {
        case 'tests-list':
            loadTestsList();
            break;
        case 'history':
            loadHistory();
            break;
        case 'stats':
            loadStats();
            break;
    }
}

// Tests List
async function loadTestsList() {
    const container = document.getElementById('tests-grid');
    container.innerHTML = '<div class="loading"><div class="spinner"></div>Загрузка тестов...</div>';
    
    try {
        const tests = await db.getTestsWithResults(currentUser.id);
        
        container.innerHTML = '';
        
        if (!tests || tests.length === 0) {
            container.innerHTML = '<p class="no-tests">Тесты скоро появятся</p>';
            return;
        }
        
        tests.forEach(test => {
            const card = document.createElement('div');
            card.className = 'test-card';
            
            let statusBadge = '';
            if (test.passed) {
                statusBadge = '<span class="test-badge passed">Сдан</span>';
            } else if (test.attempts > 0) {
                statusBadge = '<span class="test-badge failed">Не сдан</span>';
            } else {
                statusBadge = '<span class="test-badge new">Новый</span>';
            }
            
            card.innerHTML = `
                <div class="test-card-header">
                    <span class="test-category">${test.category || 'Охрана труда'}</span>
                    ${statusBadge}
                </div>
                <h3 class="test-card-title">${test.title}</h3>
                <p class="test-card-description">${test.description || ''}</p>
                <div class="test-card-meta">
                    <span>${test.passing_score}% проходной балл</span>
                </div>
                ${test.bestScore !== null ? `<div class="test-card-score">Лучший результат: ${test.bestScore}%</div>` : ''}
                <button class="btn btn-primary" onclick="startTest('${test.id}')">
                    ${test.attempts > 0 ? 'Пройти заново' : 'Начать тест'}
                </button>
            `;
            
            container.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading tests:', error);
        container.innerHTML = '<p class="no-tests">Ошибка загрузки тестов</p>';
    }
}

// Start Test
async function startTest(testId) {
    try {
        const { test, questions } = await db.getTestWithQuestions(testId);
        
        if (!test || questions.length === 0) {
            alert('Тест недоступен');
            return;
        }
        
        currentTest = {
            id: test.id,
            title: test.title,
            description: test.description,
            passingScore: test.passing_score,
            timeLimit: test.time_limit,
            questions: questions
        };
        
        currentQuestionIndex = 0;
        testAnswers = {};
        
        document.getElementById('test-title').textContent = test.title;
        document.getElementById('test-description').textContent = test.description || '';
        document.getElementById('test-questions-count').textContent = `${questions.length} вопросов`;
        document.getElementById('test-time-limit').textContent = test.time_limit > 0 ? `${test.time_limit} мин` : 'Без ограничения времени';
        document.getElementById('test-passing-score').textContent = `Проходной балл: ${test.passing_score}%`;
        
        navigateTo('test');
        renderQuestion();
        
    } catch (error) {
        console.error('Error starting test:', error);
        alert('Ошибка при загрузке теста');
    }
}

function renderQuestion() {
    const question = currentTest.questions[currentQuestionIndex];
    const container = document.getElementById('test-container');
    const progressFill = document.getElementById('test-progress-fill');
    const progressText = document.getElementById('test-progress-text');
    const prevBtn = document.getElementById('test-prev-btn');
    const nextBtn = document.getElementById('test-next-btn');
    
    const progress = ((currentQuestionIndex + 1) / currentTest.questions.length) * 100;
    progressFill.style.width = progress + '%';
    progressText.textContent = `Вопрос ${currentQuestionIndex + 1} из ${currentTest.questions.length}`;
    
    prevBtn.classList.toggle('hidden', currentQuestionIndex === 0);
    nextBtn.textContent = currentQuestionIndex === currentTest.questions.length - 1 ? 'Завершить' : 'Далее';
    
    let optionsHtml = '';
    
    if (question.question_type === 'text') {
        optionsHtml = `
            <div class="form-group">
                <input type="text" id="text-answer" placeholder="Введите ваш ответ" value="${testAnswers[currentQuestionIndex] || ''}">
            </div>
        `;
    } else {
        const options = question.options || [];
        optionsHtml = '<div class="test-options">';
        
        options.forEach((option, idx) => {
            const isSelected = question.question_type === 'single' 
                ? testAnswers[currentQuestionIndex] === idx
                : (testAnswers[currentQuestionIndex] || []).includes(idx);
            
            optionsHtml += `
                <label class="test-option ${isSelected ? 'selected' : ''}">
                    <input type="${question.question_type === 'multiple' ? 'checkbox' : 'radio'}" 
                           name="question-${currentQuestionIndex}" 
                           value="${idx}"
                           ${isSelected ? 'checked' : ''}
                           onchange="handleOptionSelect(${idx}, '${question.question_type}')">
                    <span class="test-option-text">${option}</span>
                </label>
            `;
        });
        
        optionsHtml += '</div>';
    }
    
    container.innerHTML = `
        <div class="test-question">
            <div class="test-question-number">Вопрос ${currentQuestionIndex + 1}</div>
            <div class="test-question-text">${question.question_text}</div>
            ${optionsHtml}
        </div>
    `;
}

function handleOptionSelect(optionIndex, questionType) {
    if (questionType === 'single') {
        testAnswers[currentQuestionIndex] = optionIndex;
    } else if (questionType === 'multiple') {
        if (!testAnswers[currentQuestionIndex]) {
            testAnswers[currentQuestionIndex] = [];
        }
        const idx = testAnswers[currentQuestionIndex].indexOf(optionIndex);
        if (idx > -1) {
            testAnswers[currentQuestionIndex].splice(idx, 1);
        } else {
            testAnswers[currentQuestionIndex].push(optionIndex);
        }
    }
    
    document.querySelectorAll('.test-option').forEach((opt, idx) => {
        if (questionType === 'single') {
            opt.classList.toggle('selected', idx === optionIndex);
        } else {
            const checkbox = opt.querySelector('input');
            opt.classList.toggle('selected', checkbox.checked);
        }
    });
}

function prevQuestion() {
    saveCurrentAnswer();
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function nextQuestion() {
    saveCurrentAnswer();
    
    if (currentQuestionIndex < currentTest.questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        finishTest();
    }
}

function saveCurrentAnswer() {
    const question = currentTest.questions[currentQuestionIndex];
    
    if (question.question_type === 'text') {
        const input = document.getElementById('text-answer');
        if (input) {
            testAnswers[currentQuestionIndex] = input.value;
        }
    }
}

async function finishTest() {
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    
    currentTest.questions.forEach((question, idx) => {
        totalPoints += question.points || 1;
        const answer = testAnswers[idx];
        
        let isCorrect = false;
        
        if (question.question_type === 'text') {
            const correct = (question.correct_answer || '').toString().toLowerCase().trim();
            const userAns = (answer || '').toString().toLowerCase().trim();
            isCorrect = correct === userAns;
        } else if (question.question_type === 'single') {
            isCorrect = answer === question.correct_answer;
        } else if (question.question_type === 'multiple') {
            const correctSet = new Set(question.correct_answer || []);
            const answerSet = new Set(answer || []);
            isCorrect = correctSet.size === answerSet.size && 
                        [...correctSet].every(x => answerSet.has(x));
        }
        
        if (isCorrect) {
            earnedPoints += question.points || 1;
            correctCount++;
        }
    });
    
    const score = Math.round((earnedPoints / totalPoints) * 100);
    const passed = score >= currentTest.passingScore;
    
    try {
        await db.saveTestResult(currentUser.id, currentTest.id, score, passed, testAnswers);
    } catch (error) {
        console.error('Error saving test result:', error);
    }
    
    showTestResult(score, passed, correctCount, currentTest.questions.length);
}

function showTestResult(score, passed, correct, total) {
    const icon = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const scoreEl = document.getElementById('result-score');
    const message = document.getElementById('result-message');
    const correctEl = document.getElementById('result-correct');
    const totalEl = document.getElementById('result-total');
    
    icon.classList.toggle('failed', !passed);
    title.textContent = passed ? 'Тест пройден!' : 'Тест не пройден';
    scoreEl.textContent = score + '%';
    scoreEl.classList.toggle('failed', !passed);
    message.textContent = passed 
        ? 'Поздравляем! Вы успешно сдали тест.'
        : `Вы не набрали достаточное количество баллов. Минимальный проходной балл: ${currentTest.passingScore}%`;
    correctEl.textContent = correct;
    totalEl.textContent = total;
    
    navigateTo('test-result');
}

function retryTest() {
    currentQuestionIndex = 0;
    testAnswers = {};
    startTest(currentTest.id);
}

function backToTests() {
    navigateTo('tests-list');
}

// History
async function loadHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '<div class="loading"><div class="spinner"></div>Загрузка...</div>';
    
    try {
        const results = await db.getUserTestResults(currentUser.id);
        
        container.innerHTML = '';
        
        if (!results || results.length === 0) {
            container.innerHTML = '<p class="no-tests">Вы ещё не проходили тесты</p>';
            return;
        }
        
        results.forEach(result => {
            const date = new Date(result.completed_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-info">
                    <h4 class="history-title">${result.tests?.title || 'Тест'}</h4>
                    <span class="history-date">${date}</span>
                </div>
                <div class="history-score">
                    <span class="history-badge ${result.passed ? 'passed' : 'failed'}">
                        ${result.passed ? 'Сдан' : 'Не сдан'}
                    </span>
                    <span class="history-value">${result.score}%</span>
                </div>
            `;
            
            container.appendChild(item);
        });
        
    } catch (error) {
        console.error('Error loading history:', error);
        container.innerHTML = '<p class="no-tests">Ошибка загрузки истории</p>';
    }
}

// Stats
async function loadStats() {
    try {
        const results = await db.getUserTestResults(currentUser.id);
        
        const totalAttempts = results.length;
        const passed = results.filter(r => r.passed).length;
        const bestScore = results.length > 0 
            ? Math.max(...results.map(r => r.score))
            : 0;
        const avgScore = results.length > 0 
            ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
            : 0;
        
        document.getElementById('stat-total-attempts').textContent = totalAttempts;
        document.getElementById('stat-passed').textContent = passed;
        document.getElementById('stat-best-score').textContent = bestScore + '%';
        document.getElementById('stat-avg-score').textContent = avgScore + '%';
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}
