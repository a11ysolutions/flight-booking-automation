export async function validateElement(
  page: any,
  selector: string,
  description?: string,
  childSelector?: string,
  interactionTest?: {
    type: "click" | "focus" | "hover" | "keydown";
    key?: string;
    expectStateChange?: boolean;
  }
) {
  const testStart = Date.now();
  const container = await page.$(selector);
  const found = !!container;

  let details = null;
  let childFound = false;
  let childDetails = null;
  let interactionResult = null;
  let domChanges = null;

  if (found) {
    details = await analyzeAccessibility(container);
    if (description) console.log(`✅ ${description} container found`);
    const initialDomState = await captureNearbyElements(page, container);
    if (childSelector) {
      const childElement = await container.$(childSelector);
      childFound = !!childElement;
      if (childFound) {
        childDetails = await analyzeAccessibility(childElement);
        if (description) console.log(`✅ Child element found within ${description}`);
        if (interactionTest) {
          const interactionData = await testInteractionWithDomAnalysis(
            page,
            childElement,
            interactionTest,
            initialDomState
          );
          interactionResult = interactionData.interactionResult;
          domChanges = interactionData.domChanges;
        }
      } else {
        if (description) console.log(`❌ Child element NOT found within ${description}`);
      }
    } else if (interactionTest) {
      const interactionData = await testInteractionWithDomAnalysis(
        page,
        container,
        interactionTest,
        initialDomState
      );
      interactionResult = interactionData.interactionResult;
      domChanges = interactionData.domChanges;
    }
  } else {
    if (description) console.log(`❌ ${description} container NOT found`);
  }
  const executionTime = Date.now() - testStart;
  return {
    found,
    details,
    childFound,
    childDetails,
    interactionResult,
    domChanges,
    executionTime
  };
}

async function captureNearbyElements(page: any, element: any) {
  return await page.evaluate((el: Element) => {
    const rect = el.getBoundingClientRect();
    const parent = el.parentElement;
    const nearbyElements = Array.from(document.querySelectorAll('div, ul, section')).filter(candidate => {
      if (candidate === el || el.contains(candidate) || candidate.contains(el)) return false;
      const candidateRect = candidate.getBoundingClientRect();
      const isNearby = Math.abs(candidateRect.top - rect.bottom) < 200 &&
        Math.abs(candidateRect.left - rect.left) < 200;
      return isNearby && candidateRect.width > 50 && candidateRect.height > 20;
    });
    return {
      elementPosition: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
      parentTagName: parent?.tagName || null,
      siblings: Array.from(parent?.children || []).map(sibling => ({
        tagName: sibling.tagName,
        className: sibling.className,
        id: sibling.id,
        isVisible: (sibling as HTMLElement).offsetParent !== null,
        hasAriaExpanded: sibling.hasAttribute('aria-expanded'),
        ariaExpanded: sibling.getAttribute('aria-expanded')
      })),
      nearbyElements: nearbyElements.map(nearby => ({
        tagName: nearby.tagName,
        className: nearby.className,
        id: nearby.id,
        isVisible: (nearby as HTMLElement).offsetParent !== null,
        position: {
          top: nearby.getBoundingClientRect().top,
          left: nearby.getBoundingClientRect().left,
          width: nearby.getBoundingClientRect().width,
          height: nearby.getBoundingClientRect().height
        }
      }))
    };
  }, element);
}

async function testInteractionWithDomAnalysis(
  page: any,
  element: any,
  interaction: any,
  initialDomState: any
) {
  const interactionStart = Date.now();
  let success = false;
  let error = null;
  let stateChange = null;
  let domChanges = null;
  try {
    const initialState = await element.evaluate((el: Element) => ({
      focused: el === document.activeElement,
      ariaExpanded: el.getAttribute('aria-expanded'),
      ariaPressed: el.getAttribute('aria-pressed'),
      ariaSelected: el.getAttribute('aria-selected')
    }));
    switch (interaction.type) {
      case "click":
        await element.click();
        break;
      case "focus":
        await element.focus();
        break;
      case "hover":
        await element.hover();
        break;
      case "keydown":
        await element.focus();
        if (interaction.key) {
          await element.press(interaction.key);
        }
        break;
    }
    await page.waitForTimeout(300);
    const finalDomState = await captureNearbyElements(page, element);
    const finalState = await element.evaluate((el: Element) => ({
      focused: el === document.activeElement,
      ariaExpanded: el.getAttribute('aria-expanded'),
      ariaPressed: el.getAttribute('aria-pressed'),
      ariaSelected: el.getAttribute('aria-selected')
    }));
    domChanges = analyzeDomChanges(initialDomState, finalDomState);
    stateChange = {
      focusChanged: initialState.focused !== finalState.focused,
      ariaExpandedChanged: initialState.ariaExpanded !== finalState.ariaExpanded,
      ariaPressedChanged: initialState.ariaPressed !== finalState.ariaPressed,
      ariaSelectedChanged: initialState.ariaSelected !== finalState.ariaSelected
    };
    success = true;
  } catch (err: any) {
    error = err.message;
  }
  const interactionTime = Date.now() - interactionStart;
  return {
    interactionResult: {
      type: interaction.type,
      success,
      error,
      interactionTime,
      stateChange,
      accessibilityScore: calculateAccessibilityScore(stateChange, success, domChanges)
    },
    domChanges
  };
}

function analyzeDomChanges(initialState: any, finalState: any) {
  const changes = {
    newElements: [] as any[],
    changedVisibility: [] as any[],
    expandedElements: [] as any[],
    interactionType: 'none' as string,
    description: '' as string
  };

  const initialVisibleElements = initialState.nearbyElements.filter((el: any) => el.isVisible);
  const finalVisibleElements = finalState.nearbyElements.filter((el: any) => el.isVisible);

  finalVisibleElements.forEach((finalEl: any) => {
    const wasVisible = initialVisibleElements.some((initialEl: any) =>
      initialEl.className === finalEl.className &&
      initialEl.tagName === finalEl.tagName &&
      Math.abs(initialEl.position.top - finalEl.position.top) < 50
    );
    if (!wasVisible) {
      changes.newElements.push(finalEl);
    }
  });

  finalState.siblings.forEach((finalSibling: any, index: number) => {
    const initialSibling = initialState.siblings[index];
    if (initialSibling && initialSibling.isVisible !== finalSibling.isVisible) {
      changes.changedVisibility.push({
        element: finalSibling,
        wasVisible: initialSibling.isVisible,
        nowVisible: finalSibling.isVisible
      });
    }
    if (initialSibling && initialSibling.ariaExpanded !== finalSibling.ariaExpanded) {
      changes.expandedElements.push({
        element: finalSibling,
        wasExpanded: initialSibling.ariaExpanded,
        nowExpanded: finalSibling.ariaExpanded
      });
    }
  });

  if (changes.newElements.length > 0) {
    const newElement = changes.newElements[0];
    if (newElement.tagName === 'UL' || newElement.className.includes('dropdown') || newElement.className.includes('menu')) {
      changes.interactionType = 'dropdown';
      changes.description = `Opened dropdown with ${changes.newElements.length} new elements`;
    } else if (newElement.className.includes('modal') || newElement.className.includes('dialog')) {
      changes.interactionType = 'modal';
      changes.description = `Opened modal dialog`;
    } else if (newElement.tagName === 'INPUT' || newElement.className.includes('input')) {
      changes.interactionType = 'input_expansion';
      changes.description = `Expanded input field`;
    } else {
      changes.interactionType = 'content_expansion';
      changes.description = `Revealed additional content`;
    }
  } else if (changes.changedVisibility.length > 0) {
    changes.interactionType = 'visibility_toggle';
    changes.description = `Toggled visibility of ${changes.changedVisibility.length} elements`;
  } else if (changes.expandedElements.length > 0) {
    changes.interactionType = 'aria_expansion';
    changes.description = `Changed aria-expanded state`;
  }

  return changes;
}


function calculateAccessibilityScore(stateChange: any, success: boolean, domChanges: any): number {
  if (!success) return 0;
  let score = 50;
  if (stateChange?.focusChanged) score += 20;
  if (stateChange?.ariaExpandedChanged) score += 15;
  if (stateChange?.ariaPressedChanged) score += 10;
  if (stateChange?.ariaSelectedChanged) score += 5;
  if (domChanges?.interactionType !== 'none') {
    score += 10;
    if (domChanges.expandedElements.length > 0) score += 5;
  }
  return Math.min(score, 100);
}

async function analyzeAccessibility(element: any) {
  return {
    tagName: await element.evaluate((el: Element) => el.tagName),
    isVisible: await element.isVisible(),
    isFocusable: await element.evaluate((el: Element) => {
      const htmlEl = el as HTMLElement;
      return htmlEl.tabIndex >= 0 ||
        ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'].includes(el.tagName) ||
        el.hasAttribute('tabindex');
    }),
    ariaAttributes: await element.evaluate((el: Element) => {
      const aria: Record<string, string> = {};
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        if (attr.name.startsWith('aria-') || attr.name === 'role') {
          aria[attr.name] = attr.value;
        }
      }
      return aria;
    }),
    accessibleName: await element.evaluate((el: Element) => {
      return el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby') ||
        el.getAttribute('alt') ||
        el.getAttribute('title') ||
        (el as HTMLElement).innerText?.trim() ||
        null;
    }),
    hasValidSemantics: await element.evaluate((el: Element) => {
      const interactiveElements = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
      const hasRole = el.hasAttribute('role');
      const isSemanticElement = interactiveElements.includes(el.tagName);
      return isSemanticElement || hasRole;
    })
  };
}
