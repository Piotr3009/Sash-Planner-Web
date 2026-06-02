/**
 * Joinery Core - PUBLIC chat widget (landing page)
 *
 * For non-logged-in visitors. Talks to /api/chat-public (sales assistant).
 * No auth token, no tours. Conversation kept in memory only.
 * Bot replies inserted via textContent (no innerHTML) to prevent XSS.
 *
 * Add to the landing page with:
 *   <script defer src="js/chat-widget-public.js?v=1"></script>
 */
(function () {
    'use strict';

    var API_PATH = '/api/chat-public';
    var MAX_LEN = 2000;
    var history = [];
    var isOpen = false;
    var isSending = false;

    var css = ''
        + '.jc-chat-btn{position:fixed;right:24px;bottom:24px;width:68px;height:68px;border-radius:50%;'
        + 'background:#AA8E68;border:none;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.4);'
        + 'display:flex;align-items:center;justify-content:center;z-index:99998;transition:transform .15s;}'
        + '.jc-chat-btn:hover{transform:scale(1.06);}'
        + '.jc-chat-btn svg{width:32px;height:32px;stroke:#fff;}'
        // Comet entrance: fly in from centre along an arc, land in the corner
        + '.jc-chat-btn.jc-comet{animation:jcComet 1.3s cubic-bezier(.5,.05,.5,1) forwards;}'
        + '.jc-chat-btn.jc-comet::after{content:"";position:absolute;right:50%;bottom:50%;'
        + 'width:120px;height:10px;border-radius:10px;transform-origin:right center;'
        + 'transform:rotate(45deg);background:linear-gradient(90deg,rgba(170,142,104,0),rgba(170,142,104,.85));'
        + 'animation:jcTail 1.3s ease-out forwards;pointer-events:none;}'
        + '@keyframes jcComet{'
        + '0%{transform:translate(calc(-50vw + 58px),calc(-50vh + 58px)) scale(1.6) rotate(-90deg);'
        + 'box-shadow:0 0 30px 8px rgba(170,142,104,.7);}'
        + '55%{transform:translate(calc(-26vw + 58px),calc(-12vh + 58px)) scale(1.3) rotate(180deg);'
        + 'box-shadow:0 0 24px 6px rgba(170,142,104,.6);}'
        + '100%{transform:translate(0,0) scale(1) rotate(360deg);'
        + 'box-shadow:0 6px 22px rgba(0,0,0,.4);}}'
        + '@keyframes jcTail{0%{opacity:0;}25%{opacity:1;width:160px;}70%{opacity:.9;width:100px;}'
        + '100%{opacity:0;width:0;}}'
        + '.jc-chat-label{position:fixed;right:104px;bottom:42px;z-index:99998;background:#1e1e1e;'
        + 'color:#e8e2d5;border:1px solid #AA8E68;border-radius:22px;padding:10px 16px;font-size:14px;'
        + 'font-weight:600;font-family:inherit;box-shadow:0 4px 16px rgba(0,0,0,.35);cursor:pointer;'
        + 'white-space:nowrap;display:flex;align-items:center;gap:8px;}'
        + '.jc-chat-label .jc-label-x{color:#888;font-size:16px;line-height:1;}'
        + '.jc-chat-label.jc-hide{display:none;}'
        + '.jc-chat-panel{position:fixed;right:24px;bottom:104px;width:720px;max-width:calc(100vw - 48px);'
        + 'height:80vh;max-height:calc(100vh - 140px);background:#1e1e1e;border:1px solid #3a3a3a;'
        + 'border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.45);z-index:99999;display:none;'
        + 'flex-direction:column;overflow:hidden;font-family:inherit;}'
        + '.jc-chat-panel.jc-open{display:flex;}'
        + '.jc-chat-header{background:#AA8E68;color:#fff;padding:12px 16px;display:flex;'
        + 'align-items:center;justify-content:space-between;font-weight:600;font-size:15px;}'
        + '.jc-chat-header .jc-chat-close{background:none;border:none;color:#fff;cursor:pointer;'
        + 'font-size:20px;line-height:1;padding:0 4px;}'
        + '.jc-chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}'
        + '.jc-chat-msg{max-width:85%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.45;'
        + 'white-space:pre-wrap;word-wrap:break-word;}'
        + '.jc-chat-msg.jc-user{align-self:flex-end;background:#AA8E68;color:#fff;border-bottom-right-radius:4px;}'
        + '.jc-chat-msg.jc-bot{align-self:flex-start;background:#2c2c2c;color:#e8e2d5;border-bottom-left-radius:4px;}'
        + '.jc-chat-msg.jc-err{align-self:flex-start;background:#3a2323;color:#f0b4b4;border-bottom-left-radius:4px;}'
        + '.jc-chat-typing{align-self:flex-start;color:#888;font-size:13px;font-style:italic;padding:4px 12px;}'
        + '.jc-chat-input{display:flex;gap:8px;padding:10px;border-top:1px solid #3a3a3a;background:#1e1e1e;}'
        + '.jc-chat-input textarea{flex:1;resize:none;background:#2c2c2c;border:1px solid #3a3a3a;'
        + 'border-radius:8px;color:#e8e2d5;padding:9px 11px;font-size:14px;font-family:inherit;'
        + 'max-height:90px;outline:none;}'
        + '.jc-chat-input textarea:focus{border-color:#AA8E68;}'
        + '.jc-chat-send{background:#AA8E68;border:none;border-radius:8px;color:#fff;cursor:pointer;'
        + 'padding:0 16px;font-weight:600;font-size:14px;}'
        + '.jc-chat-send:disabled{opacity:.5;cursor:not-allowed;}';

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    var btn = document.createElement('button');
    btn.className = 'jc-chat-btn';
    btn.setAttribute('aria-label', 'Chat');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
        + '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7'
        + 'a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

    var panel = document.createElement('div');
    panel.className = 'jc-chat-panel';
    panel.innerHTML = ''
        + '<div class="jc-chat-header"><span>Joinery Core</span>'
        + '<button class="jc-chat-close" aria-label="Close">&times;</button></div>'
        + '<div class="jc-chat-msgs" id="jcpMsgs"></div>'
        + '<div class="jc-chat-input">'
        + '<textarea id="jcpInput" rows="1" placeholder="Ask about Joinery Core..."></textarea>'
        + '<button class="jc-chat-send" id="jcpSend">Send</button>'
        + '</div>';

    var label = document.createElement('div');
    label.className = 'jc-chat-label';
    label.innerHTML = '<span class="jc-label-text">Questions? Ask me \u2192</span>'
        + '<span class="jc-label-x" aria-label="Dismiss">&times;</span>';

    document.body.appendChild(btn);
    document.body.appendChild(label);
    document.body.appendChild(panel);

    var msgsEl = panel.querySelector('#jcpMsgs');
    var inputEl = panel.querySelector('#jcpInput');
    var sendEl = panel.querySelector('#jcpSend');
    var closeEl = panel.querySelector('.jc-chat-close');

    function scrollDown() { msgsEl.scrollTop = msgsEl.scrollHeight; }

    function addMessage(text, kind) {
        var div = document.createElement('div');
        div.className = 'jc-chat-msg ' + (kind === 'user' ? 'jc-user' : kind === 'err' ? 'jc-err' : 'jc-bot');
        div.textContent = text;
        msgsEl.appendChild(div);
        scrollDown();
    }

    function showTyping() {
        var t = document.createElement('div');
        t.className = 'jc-chat-typing';
        t.id = 'jcpTyping';
        t.textContent = 'typing...';
        msgsEl.appendChild(t);
        scrollDown();
    }
    function removeTyping() {
        var t = msgsEl.querySelector('#jcpTyping');
        if (t) t.remove();
    }

    function hideLabel() { label.classList.add('jc-hide'); }

    function openPanel() {
        isOpen = true;
        hideLabel();
        panel.classList.add('jc-open');
        if (history.length === 0) {
            addMessage('Hi! Curious about Joinery Core? Ask me anything — what it does, what it costs, or whether it fits your workshop.', 'bot');
        }
        inputEl.focus();
    }
    function closePanel() {
        isOpen = false;
        panel.classList.remove('jc-open');
    }

    function setSending(state) {
        isSending = state;
        sendEl.disabled = state;
    }

    function send() {
        if (isSending) return;
        var text = inputEl.value.trim();
        if (!text) return;
        if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);

        addMessage(text, 'user');
        history.push({ role: 'user', content: text });
        inputEl.value = '';
        inputEl.style.height = 'auto';

        setSending(true);
        showTyping();

        fetch(API_PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: history })
        })
            .then(function (resp) {
                return resp.json().then(function (data) {
                    return { ok: resp.ok, status: resp.status, data: data };
                });
            })
            .then(function (res) {
                removeTyping();
                if (res.ok && res.data && res.data.reply) {
                    addMessage(res.data.reply, 'bot');
                    history.push({ role: 'assistant', content: res.data.reply });
                } else if (res.status === 429) {
                    addMessage('Too many messages right now. Please try again a bit later.', 'err');
                    history.pop();
                } else {
                    var msg = (res.data && res.data.error) ? res.data.error : 'Something went wrong. Please try again.';
                    addMessage(msg, 'err');
                    history.pop();
                }
            })
            .catch(function () {
                removeTyping();
                addMessage('Network error. Please check your connection and try again.', 'err');
                history.pop();
            })
            .finally(function () {
                setSending(false);
                if (isOpen) inputEl.focus();
            });
    }

    btn.addEventListener('click', function () {
        isOpen ? closePanel() : openPanel();
    });
    label.querySelector('.jc-label-text').addEventListener('click', openPanel);
    label.querySelector('.jc-label-x').addEventListener('click', function (e) {
        e.stopPropagation();
        hideLabel();
    });
    closeEl.addEventListener('click', closePanel);
    sendEl.addEventListener('click', send);

    inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    });
    inputEl.addEventListener('input', function () {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + 'px';
    });
    // Comet entrance — TEST MODE: plays on every page load (no session guard)
    label.classList.add('jc-hide');
    btn.style.opacity = '0';
    setTimeout(function () {
        btn.style.opacity = '';
        btn.classList.add('jc-comet');
        btn.addEventListener('animationend', function onEnd(e) {
            if (e.animationName !== 'jcComet') return;
            btn.classList.remove('jc-comet');
            btn.removeEventListener('animationend', onEnd);
            if (!isOpen) label.classList.remove('jc-hide');
        });
    }, 1000);
})();
