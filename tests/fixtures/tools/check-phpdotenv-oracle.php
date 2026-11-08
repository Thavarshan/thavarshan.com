<?php
/**
 * Optional development-only oracle. Run with PHP and vlucas/phpdotenv:5.6.2
 * installed in an isolated temporary directory; never upload .env files.
 *
 *   php /path/to/repo/tests/fixtures/tools/check-phpdotenv-oracle.php /tmp/dotenv-oracle/vendor/autoload.php
 */

declare(strict_types=1);

$autoload = $argv[1] ?? null;
if ($autoload === null || !is_file($autoload)) {
    fwrite(STDERR, "Pass a phpdotenv v5.6.2 vendor/autoload.php path.\n");
    exit(2);
}
require $autoload;

$fixtures = json_decode(file_get_contents(__DIR__ . '/phpdotenv-v5.6.2.json'), true, 512, JSON_THROW_ON_ERROR);
$failures = 0;
foreach ($fixtures['cases'] as $fixture) {
    try {
        $actual = \Dotenv\Dotenv::parse($fixture['source']);
        $matches = !isset($fixture['error']) && $actual === $fixture['values'];
    } catch (\Dotenv\Exception\InvalidFileException $error) {
        $matches = $fixture['error'] ?? false;
    }
    if (!$matches) {
        fwrite(STDERR, "Fixture disagrees with phpdotenv: {$fixture['name']}\n");
        $failures++;
    }
}
exit($failures ? 1 : 0);
