/* global hexo */

'use strict';

hexo.extend.filter.register('theme_inject', injects => {
  const config = hexo.theme.config.giscus;

  if (!config || !config.enable) return;

  if (!config.repo || !config.repo_id || !config.category || !config.category_id) {
    hexo.log.warn('giscus repository and category configuration cannot be empty.');
    return;
  }

  injects.comment.file(
    'giscus',
    'source/_data/giscus.njk',
    { button: 'Giscus', class: 'giscus' },
    { cache: false }
  );
});
