import SftpClient from 'ssh2-sftp-client';
import { config } from 'dotenv';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';

config();

/**
 * Get the current git branch name
 */
const getCurrentBranch = (): string => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
};

/**
 * Prompt user for confirmation
 */
const confirmDeploy = (branch: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.warn('\n⚠️  WARNING: You are not on the master branch!');
    console.warn(`   Current branch: ${branch}\n`);

    rl.question('Do you really want to deploy this branch? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
};

const deploy = async (): Promise<void> => {
  // Check current branch
  const currentBranch = getCurrentBranch();

  if (currentBranch !== 'master') {
    const confirmed = await confirmDeploy(currentBranch);
    if (!confirmed) {
      console.log('Deploy cancelled.');
      process.exit(0);
    }
    console.log(`Proceeding with deploy from branch: ${currentBranch}\n`);
  }
  const { SFTP_HOST, SFTP_USER, SFTP_PASSWORD, SFTP_PATH, SFTP_PORT } = process.env;

  if (!SFTP_HOST || !SFTP_USER || !SFTP_PASSWORD || !SFTP_PATH) {
    console.error('Missing SFTP configuration. Please check your .env file.');
    console.error('Required: SFTP_HOST, SFTP_USER, SFTP_PASSWORD, SFTP_PATH');
    console.error('Optional: SFTP_PORT (default: 22)');
    process.exit(1);
  }

  const sftp = new SftpClient();

  try {
    console.log(`Connecting to ${SFTP_HOST}...`);

    await sftp.connect({
      host: SFTP_HOST,
      port: parseInt(SFTP_PORT || '22'),
      username: SFTP_USER,
      password: SFTP_PASSWORD,
    });

    console.log(`Uploading to ${SFTP_PATH}...`);

    // Prüfe, ob Zielverzeichnis existiert
    const exists = await sftp.exists(SFTP_PATH);
    if (exists) {
      // Verzeichnis leeren
      const files = await sftp.list(SFTP_PATH);
      for (const file of files) {
        const remotePath = `${SFTP_PATH}/${file.name}`;
        if (file.type === 'd') {
          await sftp.rmdir(remotePath, true);
        } else {
          await sftp.delete(remotePath);
        }
      }
    } else {
      await sftp.mkdir(SFTP_PATH, true);
    }

    // Upload dist Verzeichnis
    await sftp.uploadDir(resolve('dist'), SFTP_PATH);

    console.log('Deploy complete!');
  } catch (error) {
    console.error('Deploy failed:', error);
    process.exit(1);
  } finally {
    await sftp.end();
  }
};

void deploy();
