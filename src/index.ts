/**
 * SVU Member Data Explorer
 * Password-protected dashboard for browsing D1 member database
 */

interface Env {
	svu_prod: D1Database;
	ADMIN_PASSWORD?: string;
}

const ADMIN_PASSWORD = 'svu-admin-2025'; // Change in production via wrangler secret

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Handle authentication
		const authResult = checkAuth(request, env);
		if (authResult !== true) {
			return authResult;
		}

		// Route handlers
		if (url.pathname === '/') {
			return new Response(renderDashboard(), {
				headers: { 'Content-Type': 'text/html;charset=UTF-8' },
			});
		}

		if (url.pathname === '/api/tables') {
			return handleGetTables(env);
		}

		if (url.pathname === '/api/table-info') {
			const table = url.searchParams.get('table');
			if (!table) return jsonError('Missing table parameter', 400);
			return handleGetTableInfo(env, table);
		}

		if (url.pathname === '/api/data') {
			const table = url.searchParams.get('table');
			const page = parseInt(url.searchParams.get('page') || '1');
			const limit = parseInt(url.searchParams.get('limit') || '50');
			if (!table) return jsonError('Missing table parameter', 400);
			return handleGetData(env, table, page, limit);
		}

		if (url.pathname === '/api/search') {
			const table = url.searchParams.get('table');
			const column = url.searchParams.get('column');
			const query = url.searchParams.get('q');
			if (!table || !column || !query) {
				return jsonError('Missing required parameters', 400);
			}
			return handleSearch(env, table, column, query);
		}

		return new Response('Not Found', { status: 404 });
	},
};

function checkAuth(request: Request, env: Env): Response | true {
	const authHeader = request.headers.get('Authorization');
	const expectedPassword = env.ADMIN_PASSWORD || ADMIN_PASSWORD;

	if (!authHeader || !authHeader.startsWith('Basic ')) {
		return new Response('Authentication required', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="SVU Member Explorer"',
			},
		});
	}

	const base64Credentials = authHeader.slice(6);
	const credentials = atob(base64Credentials);
	const [username, password] = credentials.split(':');

	if (password !== expectedPassword) {
		return new Response('Invalid credentials', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="SVU Member Explorer"',
			},
		});
	}

	return true;
}

async function handleGetTables(env: Env): Promise<Response> {
	try {
		const result = await env.svu_prod
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
			.all();
		return jsonResponse({ tables: result.results });
	} catch (error: any) {
		return jsonError(error.message);
	}
}

async function handleGetTableInfo(env: Env, table: string): Promise<Response> {
	try {
		// Get column info
		const columns = await env.svu_prod.prepare(`PRAGMA table_info(${sanitizeIdentifier(table)})`).all();

		// Get row count
		const countResult = await env.svu_prod.prepare(`SELECT COUNT(*) as count FROM ${sanitizeIdentifier(table)}`).first();

		return jsonResponse({
			columns: columns.results,
			rowCount: countResult?.count || 0,
		});
	} catch (error: any) {
		return jsonError(error.message);
	}
}

async function handleGetData(env: Env, table: string, page: number, limit: number): Promise<Response> {
	try {
		const offset = (page - 1) * limit;
		const query = `SELECT * FROM ${sanitizeIdentifier(table)} LIMIT ? OFFSET ?`;
		const result = await env.svu_prod.prepare(query).bind(limit, offset).all();

		return jsonResponse({
			data: result.results,
			page,
			limit,
		});
	} catch (error: any) {
		return jsonError(error.message);
	}
}

async function handleSearch(env: Env, table: string, column: string, query: string): Promise<Response> {
	try {
		const sql = `SELECT * FROM ${sanitizeIdentifier(table)} WHERE ${sanitizeIdentifier(column)} LIKE ? LIMIT 100`;
		const result = await env.svu_prod.prepare(sql).bind(`%${query}%`).all();

		return jsonResponse({
			data: result.results,
			query,
		});
	} catch (error: any) {
		return jsonError(error.message);
	}
}

function sanitizeIdentifier(name: string): string {
	// Only allow alphanumeric and underscore for table/column names
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		throw new Error('Invalid identifier');
	}
	return name;
}

function jsonResponse(data: any): Response {
	return new Response(JSON.stringify(data), {
		headers: { 'Content-Type': 'application/json' },
	});
}

function jsonError(message: string, status = 500): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function renderDashboard(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SVU Member Data Explorer</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; margin-bottom: 10px; }
        .subtitle { color: #666; }
        .content {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        select, input, button {
            padding: 10px 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        button {
            background: #0066cc;
            color: white;
            cursor: pointer;
            border: none;
        }
        button:hover { background: #0052a3; }
        .search-box {
            display: flex;
            gap: 10px;
            flex: 1;
        }
        .search-box input { flex: 1; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            text-align: left;
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            position: sticky;
            top: 0;
        }
        tr:hover { background: #f8f9fa; }
        .pagination {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            align-items: center;
        }
        .info {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid #0066cc;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .error {
            background: #ffe7e7;
            color: #c00;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            border-left: 4px solid #c00;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏅 SVU Member Data Explorer</h1>
            <div class="subtitle">Browse member database tables and columns</div>
        </div>

        <div class="content">
            <div class="info" id="tableInfo">
                <strong>Select a table to begin</strong>
            </div>

            <div class="controls">
                <select id="tableSelect" onchange="loadTable()">
                    <option value="">-- Select Table --</option>
                </select>
                
                <div class="search-box">
                    <select id="columnSelect">
                        <option value="">-- Search Column --</option>
                    </select>
                    <input type="text" id="searchInput" placeholder="Search..." />
                    <button onclick="search()">Search</button>
                    <button onclick="clearSearch()">Clear</button>
                </div>
            </div>

            <div id="dataContainer">
                <div class="loading">Loading tables...</div>
            </div>

            <div class="pagination" id="pagination" style="display: none;">
                <button onclick="prevPage()">← Previous</button>
                <span id="pageInfo"></span>
                <button onclick="nextPage()">Next →</button>
            </div>
        </div>
    </div>

    <script>
        let currentTable = '';
        let currentPage = 1;
        let columns = [];

        async function fetchJson(url) {
            const response = await fetch(url);
            if (!response.ok) throw new Error(await response.text());
            return response.json();
        }

        async function loadTables() {
            try {
                const data = await fetchJson('/api/tables');
                const select = document.getElementById('tableSelect');
                data.tables.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t.name;
                    option.textContent = t.name;
                    select.appendChild(option);
                });
            } catch (error) {
                showError('Failed to load tables: ' + error.message);
            }
        }

        async function loadTable() {
            const table = document.getElementById('tableSelect').value;
            if (!table) return;

            currentTable = table;
            currentPage = 1;

            try {
                // Load table info
                const info = await fetchJson('/api/table-info?table=' + table);
                columns = info.columns;

                // Update column select
                const columnSelect = document.getElementById('columnSelect');
                columnSelect.innerHTML = '<option value="">-- Search Column --</option>';
                columns.forEach(col => {
                    const option = document.createElement('option');
                    option.value = col.name;
                    option.textContent = col.name;
                    columnSelect.appendChild(option);
                });

                // Show info
                document.getElementById('tableInfo').innerHTML = 
                    '<strong>' + table + '</strong> — ' + 
                    columns.length + ' columns, ' + 
                    info.rowCount + ' rows';

                // Load data
                await loadData();
            } catch (error) {
                showError('Failed to load table: ' + error.message);
            }
        }

        async function loadData() {
            if (!currentTable) return;

            try {
                const data = await fetchJson(
                    '/api/data?table=' + currentTable + 
                    '&page=' + currentPage + 
                    '&limit=50'
                );

                renderTable(data.data);
                document.getElementById('pageInfo').textContent = 'Page ' + currentPage;
                document.getElementById('pagination').style.display = 'flex';
            } catch (error) {
                showError('Failed to load data: ' + error.message);
            }
        }

        async function search() {
            const table = currentTable;
            const column = document.getElementById('columnSelect').value;
            const query = document.getElementById('searchInput').value;

            if (!table || !column || !query) {
                alert('Please select a table, column, and enter a search term');
                return;
            }

            try {
                const data = await fetchJson(
                    '/api/search?table=' + table + 
                    '&column=' + column + 
                    '&q=' + encodeURIComponent(query)
                );
                renderTable(data.data);
                document.getElementById('pagination').style.display = 'none';
            } catch (error) {
                showError('Search failed: ' + error.message);
            }
        }

        function clearSearch() {
            document.getElementById('searchInput').value = '';
            document.getElementById('columnSelect').value = '';
            loadData();
        }

        function renderTable(rows) {
            const container = document.getElementById('dataContainer');
            
            if (!rows || rows.length === 0) {
                container.innerHTML = '<div class="loading">No data found</div>';
                return;
            }

            const headers = Object.keys(rows[0]);
            let html = '<table><thead><tr>';
            headers.forEach(h => {
                html += '<th>' + escapeHtml(h) + '</th>';
            });
            html += '</tr></thead><tbody>';

            rows.forEach(row => {
                html += '<tr>';
                headers.forEach(h => {
                    const value = row[h];
                    html += '<td>' + escapeHtml(String(value === null ? 'NULL' : value)) + '</td>';
                });
                html += '</tr>';
            });

            html += '</tbody></table>';
            container.innerHTML = html;
        }

        function showError(message) {
            document.getElementById('dataContainer').innerHTML = 
                '<div class="error">' + escapeHtml(message) + '</div>';
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function prevPage() {
            if (currentPage > 1) {
                currentPage--;
                loadData();
            }
        }

        function nextPage() {
            currentPage++;
            loadData();
        }

        // Initialize
        loadTables();
    </script>
</body>
</html>`;
}
