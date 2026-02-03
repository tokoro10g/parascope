import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Visual Graph Editor',
    description: (
      <>
        Define complex engineering logic using an intuitive node-based interface.
        Built with Rete.js for a smooth and responsive modeling experience.
      </>
    ),
  },
  {
    title: 'Python-Powered',
    description: (
      <>
        Execute your models with the full power of the Python scientific stack.
        Support for NumPy, SciPy, and NetworkX in a secure sandboxed environment.
      </>
    ),
  },
  {
    title: 'Modular Design',
    description: (
      <>
        Create reusable calculation modules and nest them within other sheets.
        Build complex systems from simple, verified components.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}