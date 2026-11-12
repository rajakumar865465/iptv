/**
 * PostCSS plugin providing full Chrome 83 (and Edge 83 / Android 11 WebView)
 * compatibility for Tailwind CSS v4 while preserving native CSS Level 4 /
 * Level 5 features on modern browsers via @supports and class scoping.
 */

const LAYER_ORDER = ['properties', 'theme', 'base', 'components', 'utilities', 'unlayered'];
const UNSAFE_GROUP_PSEUDOS = /(::file-selector-button|:focus-visible)/;

const RGB_THEME_VARS = new Set([
  'base',
  'surface',
  'surface-2',
  'ink',
  'ink-muted',
  'ink-subtle',
]);

function splitTopLevel(str, sep = ',') {
  const parts = [];
  let cur = '';
  let paren = 0;
  let bracket = 0;
  let quote = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && i + 1 < str.length) {
        cur += str[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '\\' && i + 1 < str.length) {
      cur += ch + str[++i];
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')' && paren > 0) paren--;
    else if (ch === '[') bracket++;
    else if (ch === ']' && bracket > 0) bracket--;

    if (ch === sep && paren === 0 && bracket === 0) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function splitWhitespaceTopLevel(str) {
  const parts = [];
  let cur = '';
  let paren = 0;
  let bracket = 0;
  let quote = null;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && i + 1 < str.length) cur += str[++i];
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '\\' && i + 1 < str.length) {
      cur += ch + str[++i];
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')' && paren > 0) paren--;
    else if (ch === '[') bracket++;
    else if (ch === ']' && bracket > 0) bracket--;

    if (/\s/.test(ch) && paren === 0 && bracket === 0) {
      if (cur) {
        parts.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

function findMatchingParen(str, openIdx) {
  let depth = 0;
  let bracket = 0;
  let quote = null;
  for (let i = openIdx; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '\\') { i++; continue; }
    if (ch === '[') bracket++;
    else if (ch === ']' && bracket > 0) bracket--;
    else if (bracket === 0) {
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

function findCompoundStart(str, endIdx) {
  let paren = 0;
  let bracket = 0;
  for (let i = endIdx - 1; i >= 0; i--) {
    const ch = str[i];
    if (i > 0 && str[i - 1] === '\\') { i--; continue; }
    if (ch === ')') paren++;
    else if (ch === '(' && paren > 0) paren--;
    else if (ch === ']') bracket++;
    else if (ch === '[' && bracket > 0) bracket--;
    else if (paren === 0 && bracket === 0) {
      if (/\s/.test(ch) || ch === '>' || ch === '+' || ch === '~') {
        return i + 1;
      }
    }
  }
  return 0;
}

function mergeCompoundIntoBranch(compound, branch) {
  if (!compound) return branch;
  const trimmed = branch.trim();
  const subjectStart = findCompoundStart(trimmed, trimmed.length);
  const head = trimmed.slice(0, subjectStart);
  const tail = trimmed.slice(subjectStart);

  if (!tail || tail === '*') {
    return `${head}${compound}`;
  }

  const tagMatch = tail.match(/^([a-zA-Z*][a-zA-Z0-9_-]*|\*)(.*)$/);
  const compoundTagMatch = compound.match(/^([a-zA-Z*][a-zA-Z0-9_-]*|\*)(.*)$/);

  if (tagMatch && !compoundTagMatch) {
    return `${head}${tagMatch[1]}${compound}${tagMatch[2]}`;
  }
  if (compoundTagMatch && !tagMatch) {
    return `${head}${compound}${tail}`;
  }
  return `${head}${compound}${tail}`;
}

function findNextCombinatorPseudo(sel) {
  let quote = null;
  let bracket = 0;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '\\') { i++; continue; }
    if (ch === '[') bracket++;
    else if (ch === ']' && bracket > 0) bracket--;
    else if (bracket === 0 && ch === ':') {
      for (const fn of [':where(', ':is(', ':not(']) {
        if (sel.startsWith(fn, i)) {
          const openIdx = i + fn.length - 1;
          const closeIdx = findMatchingParen(sel, openIdx);
          if (closeIdx !== -1) {
            const inner = sel.slice(openIdx + 1, closeIdx);
            const args = splitTopLevel(inner, ',');
            if (fn !== ':not(' || args.length > 1) {
              return { fn, start: i, openIdx, closeIdx, args };
            }
          }
        }
      }
    }
  }
  return null;
}

function expandSelector(sel) {
  const match = findNextCombinatorPseudo(sel);
  if (!match) return [sel.trim()];

  const { fn, start, closeIdx, args } = match;
  if (fn === ':not(') {
    const replacement = args.map((a) => `:not(${a.trim()})`).join('');
    const nextSel = sel.slice(0, start) + replacement + sel.slice(closeIdx + 1);
    return expandSelector(nextSel);
  }

  const compoundStart = findCompoundStart(sel, start);
  const before = sel.slice(0, compoundStart);
  const compound = sel.slice(compoundStart, start);
  const after = sel.slice(closeIdx + 1);

  const out = [];
  for (const arg of args) {
    const merged = mergeCompoundIntoBranch(compound, arg);
    const expanded = expandSelector(`${before}${merged}${after}`);
    out.push(...expanded);
  }
  return out;
}

function expandSelectorList(selectors) {
  const out = [];
  const seen = new Set();
  for (const raw of selectors) {
    for (const s of expandSelector(raw)) {
      const normalized = s.replace(/\s+/g, ' ').trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
      }
    }
  }
  return out;
}

function combineNestedSelectors(parents, children) {
  const out = [];
  for (const c of children) {
    if (c.includes('&')) {
      for (const p of parents) {
        out.push(c.replace(/&/g, p));
      }
    } else {
      for (const p of parents) {
        out.push(`${p} ${c}`);
      }
    }
  }
  return out;
}

function wrapAtChain(node, chain) {
  let wrapped = node;
  for (let i = chain.length - 1; i >= 0; i--) {
    const outer = chain[i].clone({ nodes: [] });
    outer.append(wrapped);
    wrapped = outer;
  }
  return wrapped;
}

function flattenNodes(nodes, currentSelectors = null, atChain = []) {
  const result = [];
  const directDecls = [];

  for (const node of nodes) {
    if (node.type === 'decl') {
      if (currentSelectors) {
        directDecls.push(node.clone());
      }
    } else if (node.type === 'rule') {
      const nextSelectors = currentSelectors
        ? combineNestedSelectors(currentSelectors, node.selectors)
        : node.selectors;
      result.push(...flattenNodes(node.nodes || [], nextSelectors, atChain));
    } else if (node.type === 'atrule') {
      if (node.name === 'media' || node.name === 'supports') {
        const atClone = node.clone({ nodes: [] });
        result.push(...flattenNodes(node.nodes || [], currentSelectors, [...atChain, atClone]));
      } else {
        if (currentSelectors) {
          result.push(wrapAtChain(node.clone(), atChain));
        } else {
          result.push(node.clone());
        }
      }
    }
  }

  if (directDecls.length > 0 && currentSelectors) {
    result.unshift({
      __flatRule: true,
      selectors: currentSelectors,
      decls: directDecls,
      atChain,
    });
  }

  return result;
}

function logicalToPhysical(prop, value) {
  const vals = splitWhitespaceTopLevel(value);
  const v1 = vals[0] ?? value;
  const v2 = vals[1] ?? v1;
  const v3 = vals[2] ?? v1;
  const v4 = vals[3] ?? v2;
  switch (prop) {
    case 'inset':
      return [['top', v1], ['right', v2], ['bottom', v3], ['left', v4]];
    case 'inset-inline':
      return [['left', v1], ['right', v2]];
    case 'inset-block':
      return [['top', v1], ['bottom', v2]];
    case 'inset-inline-start':
      return [['left', value]];
    case 'inset-inline-end':
      return [['right', value]];
    case 'inset-block-start':
      return [['top', value]];
    case 'inset-block-end':
      return [['bottom', value]];
    case 'margin-inline':
      return [['margin-left', v1], ['margin-right', v2]];
    case 'margin-block':
      return [['margin-top', v1], ['margin-bottom', v2]];
    case 'margin-inline-start':
      return [['margin-left', value]];
    case 'margin-inline-end':
      return [['margin-right', value]];
    case 'margin-block-start':
      return [['margin-top', value]];
    case 'margin-block-end':
      return [['margin-bottom', value]];
    case 'padding-inline':
      return [['padding-left', v1], ['padding-right', v2]];
    case 'padding-block':
      return [['padding-top', v1], ['padding-bottom', v2]];
    case 'padding-inline-start':
      return [['padding-left', value]];
    case 'padding-inline-end':
      return [['padding-right', value]];
    case 'padding-block-start':
      return [['padding-top', value]];
    case 'padding-block-end':
      return [['padding-bottom', value]];
    case 'border-inline-style':
      return [['border-left-style', v1], ['border-right-style', v2]];
    case 'border-inline-width':
      return [['border-left-width', v1], ['border-right-width', v2]];
    case 'border-inline-color':
      return [['border-left-color', v1], ['border-right-color', v2]];
    case 'border-inline-start-style':
      return [['border-left-style', value]];
    case 'border-inline-end-style':
      return [['border-right-style', value]];
    case 'border-inline-start-width':
      return [['border-left-width', value]];
    case 'border-inline-end-width':
      return [['border-right-width', value]];
    case 'border-inline-start-color':
      return [['border-left-color', value]];
    case 'border-inline-end-color':
      return [['border-right-color', value]];
    case 'border-block-style':
      return [['border-top-style', v1], ['border-bottom-style', v2]];
    case 'border-block-width':
      return [['border-top-width', v1], ['border-bottom-width', v2]];
    case 'border-block-color':
      return [['border-top-color', v1], ['border-bottom-color', v2]];
    case 'border-block-start-style':
      return [['border-top-style', value]];
    case 'border-block-end-style':
      return [['border-bottom-style', value]];
    case 'border-block-start-width':
      return [['border-top-width', value]];
    case 'border-block-end-width':
      return [['border-bottom-width', value]];
    case 'border-block-start-color':
      return [['border-top-color', value]];
    case 'border-block-end-color':
      return [['border-bottom-color', value]];
    default:
      return null;
  }
}

function getMediaAtChainOnly(rule) {
  const chain = [];
  let p = rule.parent;
  while (p && p.type !== 'root') {
    if (p.type === 'atrule' && p.name === 'media') {
      chain.unshift(p.clone({ nodes: [] }));
    }
    p = p.parent;
  }
  return chain;
}

function parseColorMixVar(value) {
  const m = value.match(
    /^color-mix\(\s*in\s+(?:oklab|srgb)\s*,\s*var\(--color-([a-z0-9-]+)\)\s+([\d.]+)%\s*,\s*transparent\s*\)$/i
  );
  if (!m) return null;
  const [, token, pct] = m;
  if (!RGB_THEME_VARS.has(token)) return null;
  const alpha = Number((parseFloat(pct) / 100).toFixed(4));
  return { token, rgba: `rgba(var(--color-${token}-rgb), ${alpha})` };
}

function postcssChrome83() {
  return {
    postcssPlugin: 'postcss-chrome83',
    Once(root, { Rule, AtRule, Declaration }) {
      const buckets = Object.fromEntries(LAYER_ORDER.map((k) => [k, []]));

      for (const child of root.nodes) {
        if (child.type === 'atrule' && child.name === 'layer') {
          if (!child.nodes || child.nodes.length === 0) continue;
          const layerName = child.params.trim();
          if (layerName === 'properties') {
            for (const inner of child.nodes) {
              if (inner.type === 'atrule' && inner.name === 'supports') {
                for (const r of inner.nodes || []) {
                  if (r.type === 'rule' && r.selector.includes('*')) {
                    const cloned = r.clone();
                    if (!cloned.some((d) => d.prop === '--tw-rotate')) {
                      cloned.append(new Declaration({ prop: '--tw-rotate', value: '0deg' }));
                    }
                    buckets.properties.push(cloned);
                  } else {
                    buckets.properties.push(r.clone());
                  }
                }
              } else {
                buckets.properties.push(inner.clone());
              }
            }
          } else if (buckets[layerName]) {
            for (const inner of child.nodes) {
              buckets[layerName].push(inner.clone());
            }
          } else {
            for (const inner of child.nodes) {
              buckets.unlayered.push(inner.clone());
            }
          }
        } else if (child.type === 'atrule' && child.name === 'property') {
          buckets.properties.push(child.clone());
        } else if (child.type === 'comment') {
          continue;
        } else {
          buckets.unlayered.push(child.clone());
        }
      }

      function materializeFlatItems(items) {
        const nodesOut = [];
        for (const item of items) {
          if (item && item.__flatRule) {
            const expandedSelectors = expandSelectorList(item.selectors);
            if (expandedSelectors.length === 0) continue;

            const safeSelectors = [];
            const isolatedSelectors = [];
            for (const s of expandedSelectors) {
              if (UNSAFE_GROUP_PSEUDOS.test(s)) {
                isolatedSelectors.push(s);
              } else {
                safeSelectors.push(s);
              }
            }

            const makeRule = (sels) => {
              const r = new Rule({ selectors: sels });
              for (const d of item.decls) r.append(d.clone());
              return wrapAtChain(r, item.atChain);
            };

            if (safeSelectors.length > 0) nodesOut.push(makeRule(safeSelectors));
            for (const iso of isolatedSelectors) nodesOut.push(makeRule([iso]));
          } else {
            nodesOut.push(item);
          }
        }
        return nodesOut;
      }

      root.removeAll();
      for (const layerName of LAYER_ORDER) {
        const flat = flattenNodes(buckets[layerName]);
        for (const node of materializeFlatItems(flat)) {
          root.append(node);
        }
      }

      const recentRuleByKey = new Map();
      const extraAppendNodes = [];
      let hasFlexRowAtSm = false;
      let hasFlexRowAtMd = false;
      let hasFlexRowAtLg = false;
      let hasAspectVideo = false;
      let hasAspectSquare = false;
      const flexGapEntries = [];

      root.walkRules((rule) => {
        if (rule.selector === '.sm\\:flex-row') hasFlexRowAtSm = true;
        if (rule.selector === '.md\\:flex-row') hasFlexRowAtMd = true;
        if (rule.selector === '.lg\\:flex-row') hasFlexRowAtLg = true;
        if (rule.selector === '.aspect-video') hasAspectVideo = true;
        if (rule.selector === '.aspect-square') hasAspectSquare = true;

        const parentAt = rule.parent && rule.parent.type === 'atrule' ? rule.parent : null;
        const isColorMixSupports =
          parentAt &&
          parentAt.name === 'supports' &&
          parentAt.params.includes('color-mix');

        const mediaChain = getMediaAtChainOnly(rule);
        const mediaSig = mediaChain.map((m) => m.params).join('|');

        if (!isColorMixSupports) {
          recentRuleByKey.set(`${mediaSig}::${rule.selector}`, rule);
        }

        if (rule.selector === '::placeholder') {
          if (!parentAt) {
            rule.walkDecls('opacity', (d) => {
              if (d.value.trim() === '1') d.value = '0.55';
            });
            if (!rule.some((d) => d.prop === 'opacity')) {
              rule.prepend(new Declaration({ prop: 'opacity', value: '0.55' }));
            }
          } else if (isColorMixSupports) {
            if (!rule.some((d) => d.prop === 'opacity')) {
              rule.prepend(new Declaration({ prop: 'opacity', value: '1' }));
            }
          }
        } else if (rule.selectors.every((s) => /.+::placeholder$/.test(s.trim()))) {
          if (!rule.some((d) => d.prop === 'opacity')) {
            rule.prepend(new Declaration({ prop: 'opacity', value: '1' }));
          }
        }

        let hasRotateDecl = false;
        let hasTwRotateDecl = false;
        let hasScaleDecl = false;
        let hasTwScaleDecl = false;
        let hasTranslateDecl = false;
        let rotateVal = null;
        let scaleVal = null;

        const decls = rule.nodes ? [...rule.nodes] : [];
        for (const decl of decls) {
          if (decl.type !== 'decl') continue;

          if (decl.prop === 'opacity') {
            const pm = decl.value.trim().match(/^(\d+(?:\.\d+)?)%$/);
            if (pm) {
              decl.value = String(parseFloat(pm[1]) / 100);
            }
          }

          if (
            decl.prop === '--tw-gradient-position' &&
            /\s+in\s+(?:oklab|oklch|lab|lch|srgb(?:-linear)?|hsl|hwb)\b/i.test(decl.value)
          ) {
            const origValue = decl.value;
            decl.value = origValue.replace(
              /\s+in\s+(?:oklab|oklch|lab|lch|srgb(?:-linear)?|hsl|hwb)\b/gi,
              ''
            );
            const supRule = new Rule({ selectors: rule.selectors });
            supRule.append(new Declaration({ prop: '--tw-gradient-position', value: origValue }));
            const supAt = new AtRule({
              name: 'supports',
              params: '(background-image: linear-gradient(in oklab, red, blue))',
              nodes: [supRule],
            });
            extraAppendNodes.push(wrapAtChain(supAt, mediaChain));
          }

          if (/^--tw-scale-[xyz]$/.test(decl.prop)) {
            hasTwScaleDecl = true;
            const pm = decl.value.trim().match(/^(\d+(?:\.\d+)?)%$/);
            if (pm) {
              decl.value = String(parseFloat(pm[1]) / 100);
            }
          }

          if (decl.prop === '--tw-rotate') hasTwRotateDecl = true;
          if (decl.prop === 'rotate') {
            hasRotateDecl = true;
            rotateVal = decl.value;
          }
          if (decl.prop === 'scale') {
            hasScaleDecl = true;
            scaleVal = decl.value;
          }
          if (decl.prop === 'translate') {
            hasTranslateDecl = true;
          }

          if (decl.value.includes('color-mix(')) {
            const cm = parseColorMixVar(decl.value.trim());
            if (cm) {
              if (isColorMixSupports) {
                const fallbackRule = recentRuleByKey.get(`${mediaSig}::${rule.selector}`);
                let updated = false;
                if (fallbackRule) {
                  fallbackRule.walkDecls(decl.prop, (fd) => {
                    if (fd.value.trim() === `var(--color-${cm.token})`) {
                      fd.value = cm.rgba;
                      updated = true;
                    }
                  });
                }
                if (!updated) {
                  const fbRule = new Rule({ selectors: rule.selectors });
                  fbRule.append(new Declaration({ prop: decl.prop, value: cm.rgba }));
                  parentAt.cloneBefore(fbRule);
                }
              } else {
                decl.cloneBefore({ prop: decl.prop, value: cm.rgba });
                const supRule = new Rule({ selectors: rule.selectors });
                supRule.append(new Declaration({ prop: decl.prop, value: decl.value }));
                const supAt = new AtRule({
                  name: 'supports',
                  params: '(color: color-mix(in lab, red, red))',
                  nodes: [supRule],
                });
                extraAppendNodes.push(wrapAtChain(supAt, mediaChain));
                decl.remove();
                continue;
              }
            }
          }

          const physicalPairs = logicalToPhysical(decl.prop, decl.value);
          if (physicalPairs) {
            for (const [physProp, physVal] of physicalPairs) {
              decl.cloneBefore({ prop: physProp, value: physVal });
            }
          }

          if (
            (decl.prop === 'gap' || decl.prop === 'column-gap' || decl.prop === 'row-gap') &&
            rule.selectors.length === 1 &&
            rule.selectors[0].startsWith('.') &&
            !/[:\s>+~[\]]/.test(rule.selectors[0].replace(/\\:/g, '_').replace(/\\\./g, '_'))
          ) {
            flexGapEntries.push({
              selector: rule.selectors[0],
              prop: decl.prop,
              value: decl.value,
              mediaChain,
            });
          }
        }

        if (hasRotateDecl && !hasTwRotateDecl && rotateVal != null) {
          const normRot = rotateVal.trim() === 'none' ? '0deg' : rotateVal;
          rule.append(new Declaration({ prop: '--tw-rotate', value: normRot }));
        }
        if (hasScaleDecl && !hasTwScaleDecl && scaleVal != null) {
          if (scaleVal.trim() === 'none') {
            rule.append(new Declaration({ prop: '--tw-scale-x', value: '1' }));
            rule.append(new Declaration({ prop: '--tw-scale-y', value: '1' }));
          } else {
            const parts = splitWhitespaceTopLevel(scaleVal);
            const sx = parts[0] || '1';
            const sy = parts[1] || sx;
            rule.append(new Declaration({ prop: '--tw-scale-x', value: sx }));
            rule.append(new Declaration({ prop: '--tw-scale-y', value: sy }));
          }
        }

        if ((hasTranslateDecl || hasScaleDecl || hasRotateDecl) && !rule.selector.includes('*')) {
          const trRule = new Rule({ selectors: rule.selectors });
          trRule.append(
            new Declaration({
              prop: 'transform',
              value:
                'translate(var(--tw-translate-x, 0), var(--tw-translate-y, 0)) rotate(var(--tw-rotate, 0deg)) scaleX(var(--tw-scale-x, 1)) scaleY(var(--tw-scale-y, 1))',
            })
          );
          const supAt = new AtRule({
            name: 'supports',
            params: 'not (translate: 0)',
            nodes: [trRule],
          });
          extraAppendNodes.push(wrapAtChain(supAt, mediaChain));
        }
      });

      for (const n of extraAppendNodes) {
        root.append(n);
      }

      if (hasAspectVideo || hasAspectSquare) {
        const aspectNodes = [];
        if (hasAspectVideo) {
          const r1 = new Rule({ selector: '.aspect-video::before' });
          r1.append(
            new Declaration({ prop: 'content', value: '""' }),
            new Declaration({ prop: 'float', value: 'left' }),
            new Declaration({ prop: 'width', value: '0' }),
            new Declaration({ prop: 'height', value: '0' }),
            new Declaration({ prop: 'padding-top', value: '56.25%' }),
            new Declaration({ prop: 'pointer-events', value: 'none' })
          );
          const r2 = new Rule({ selector: '.aspect-video::after' });
          r2.append(
            new Declaration({ prop: 'content', value: '""' }),
            new Declaration({ prop: 'display', value: 'block' }),
            new Declaration({ prop: 'clear', value: 'both' })
          );
          aspectNodes.push(r1, r2);
        }
        if (hasAspectSquare) {
          const r1 = new Rule({ selector: '.aspect-square::before' });
          r1.append(
            new Declaration({ prop: 'content', value: '""' }),
            new Declaration({ prop: 'float', value: 'left' }),
            new Declaration({ prop: 'width', value: '0' }),
            new Declaration({ prop: 'height', value: '0' }),
            new Declaration({ prop: 'padding-top', value: '100%' }),
            new Declaration({ prop: 'pointer-events', value: 'none' })
          );
          const r2 = new Rule({ selector: '.aspect-square::after' });
          r2.append(
            new Declaration({ prop: 'content', value: '""' }),
            new Declaration({ prop: 'display', value: 'block' }),
            new Declaration({ prop: 'clear', value: 'both' })
          );
          aspectNodes.push(r1, r2);
        }
        root.append(
          new AtRule({
            name: 'supports',
            params: 'not (aspect-ratio: 1 / 1)',
            nodes: aspectNodes,
          })
        );
      }

      for (const entry of flexGapEntries) {
        const cls = entry.selector;
        const gapParts = splitWhitespaceTopLevel(entry.value);
        const rowVal = entry.prop === 'row-gap' ? entry.value : gapParts[0];
        const colVal =
          entry.prop === 'column-gap'
            ? entry.value
            : gapParts[1] ?? gapParts[0];

        if (entry.prop === 'gap' || entry.prop === 'column-gap') {
          const rowRule = new Rule({
            selectors: [
              `html.no-flex-gap .flex${cls}:not(.flex-col) > * + *`,
              `html.no-flex-gap .inline-flex${cls}:not(.flex-col) > * + *`,
            ],
          });
          rowRule.append(new Declaration({ prop: 'margin-left', value: colVal }));
          root.append(wrapAtChain(rowRule, entry.mediaChain));
        }

        if (entry.prop === 'gap' || entry.prop === 'row-gap') {
          const colRule = new Rule({
            selectors: [
              `html.no-flex-gap .flex.flex-col${cls} > * + *`,
              `html.no-flex-gap .inline-flex.flex-col${cls} > * + *`,
            ],
          });
          colRule.append(new Declaration({ prop: 'margin-top', value: rowVal }));
          root.append(wrapAtChain(colRule, entry.mediaChain));
        }

        if (entry.mediaChain.length === 0 && entry.prop === 'gap') {
          const breakpoints = [
            hasFlexRowAtSm ? ['sm', '40rem'] : null,
            hasFlexRowAtMd ? ['md', '48rem'] : null,
            hasFlexRowAtLg ? ['lg', '64rem'] : null,
          ].filter(Boolean);

          for (const [bp, minW] of breakpoints) {
            const respRule = new Rule({
              selectors: [
                `html.no-flex-gap .flex.flex-col.${bp}\\:flex-row${cls} > * + *`,
                `html.no-flex-gap .inline-flex.flex-col.${bp}\\:flex-row${cls} > * + *`,
              ],
            });
            respRule.append(
              new Declaration({ prop: 'margin-top', value: '0' }),
              new Declaration({ prop: 'margin-left', value: colVal })
            );
            root.append(
              new AtRule({
                name: 'media',
                params: `(min-width: ${minW})`,
                nodes: [respRule],
              })
            );
          }
        }
      }
    },
  };
}

postcssChrome83.postcss = true;
module.exports = postcssChrome83;
