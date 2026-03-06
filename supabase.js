// Supabase Client Configuration
// Project ID: tppzdmiozudjdkpawzbm

const SUPABASE_URL = 'https://tppzdmiozudjdkpawzbm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SUum2UPT6Ao1bEALuHHo3w_NG0uGfj3';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database functions
const db = {
    // Get all available tests
    async getTests() {
        const { data, error } = await supabaseClient
            .from('tests')
            .select('*')
            .eq('is_published', true)
            .order('created_at');
        if (error) throw error;
        return data;
    },

    // Get test with questions
    async getTestWithQuestions(testId) {
        const { data: test, error: testError } = await supabaseClient
            .from('tests')
            .select('*')
            .eq('id', testId)
            .single();
        if (testError) throw testError;

        const { data: questions, error: questionsError } = await supabaseClient
            .from('questions')
            .select('*')
            .eq('test_id', testId)
            .order('order_index');
        if (questionsError) throw questionsError;

        return { test, questions };
    },

    // Save test result
    async saveTestResult(userId, testId, score, passed, answers) {
        const { data, error } = await supabaseClient
            .from('user_test_results')
            .insert({
                user_id: userId,
                test_id: testId,
                score: score,
                passed: passed,
                answers: answers,
                completed_at: new Date().toISOString()
            })
            .select();

        if (error) throw error;
        return data;
    },

    // Get user test results
    async getUserTestResults(userId) {
        // Get results without join first
        let results = await supabaseClient
            .from('user_test_results')
            .select('*')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });

        if (results.error) throw results.error;
        results = results.data || [];

        // Get test titles separately
        if (results.length > 0) {
            const testIds = [...new Set(results.map(r => r.test_id))];
            const { data: tests } = await supabaseClient
                .from('tests')
                .select('id, title, category')
                .in('id', testIds);

            const testMap = {};
            if (tests) {
                tests.forEach(t => {
                    testMap[t.id] = t;
                });
            }

            // Add test info to results
            results = results.map(r => ({
                ...r,
                tests: testMap[r.test_id] || { title: 'Тест', category: '' }
            }));
        }

        return results;
    },

    // Get user profile
    async getUserProfile(userId) {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    // Create user profile
    async createUserProfile(userId, email, fullName) {
        const { data, error } = await supabaseClient
            .from('users')
            .insert({
                id: userId,
                email: email,
                full_name: fullName,
                role: 'employee'
            })
            .select();

        if (error) throw error;
        return data;
    },

    // Get all tests with user results
    async getTestsWithResults(userId) {
        // Get all published tests
        const { data: tests, error: testsError } = await supabaseClient
            .from('tests')
            .select('*')
            .eq('is_published', true)
            .order('created_at');
        if (testsError) throw testsError;

        // Get all results for this user
        const { data: results, error: resultsError } = await supabaseClient
            .from('user_test_results')
            .select('*')
            .eq('user_id', userId);
        if (resultsError) throw resultsError;

        return tests.map(test => {
            const testResults = results ? results.filter(r => r.test_id === test.id) : [];
            const bestResult = testResults.length > 0 
                ? testResults.reduce((best, r) => r.score > best.score ? r : best, testResults[0])
                : null;
            
            return {
                ...test,
                attempts: testResults.length,
                bestScore: bestResult ? bestResult.score : null,
                passed: bestResult ? bestResult.passed : null,
                lastAttempt: bestResult ? bestResult.completed_at : null
            };
        });
    }
};
