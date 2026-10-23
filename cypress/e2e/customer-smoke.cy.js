const pages = [
  ['Homepage', '/'],
  ['Shop', '/shop/'],
  ['Menu', '/menu/'],
  ['Custom cake', '/custom/'],
  ['My Orders', '/orders/'],
  ['Cart', '/cart/'],
];

describe('Cake Galaxy public customer smoke', () => {
  pages.forEach(([name, path]) => {
    it(name + ' loads without a server error', () => {
      cy.visit(path);
      cy.get('body').should('be.visible').and('not.be.empty');
      cy.location('pathname').should('match', new RegExp('^' + path.replace(/\\/$/, '') + '/?$'));
    });
  });

  it('homepage links to customer shopping and orders', () => {
    cy.visit('/');
    cy.get('a[href*="shop"], a[href*="menu"]').should('exist');
    cy.get('a[href*="orders"]').should('exist');
  });

  ['iphone-x', 'ipad-2', [1280, 800]].forEach((size) => {
    it('homepage has no horizontal overflow at ' + JSON.stringify(size), () => {
      if (typeof size === 'string') cy.viewport(size);
      else cy.viewport(...size);
      cy.visit('/');
      cy.document().then((doc) => {
        expect(doc.documentElement.scrollWidth, 'horizontal overflow').to.be.lte(doc.documentElement.clientWidth + 2);
      });
    });
  });

  it('loaded product images are not broken', () => {
    cy.visit('/shop/');
    cy.get('body').should('be.visible');
    cy.get('img').each(($img) => {
      const img = $img[0];
      if (!img.complete) return;
      expect(img.naturalWidth, 'image: ' + img.src).to.be.greaterThan(0);
    });
  });
});
